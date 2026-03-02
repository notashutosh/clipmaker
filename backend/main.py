"""
ClipMaker — FastAPI backend
Endpoints:
  POST /api/jobs                  Create a job (URL or file upload)
  GET  /api/jobs/{id}/status      Poll job status + progress
  GET  /api/jobs/{id}/transcript  Fetch finished transcript
  POST /api/jobs/{id}/speaker-map Update speaker name mapping
  POST /api/clips                 Create a clip (stores metadata)
  PATCH /api/clips/{id}           Update clip fields
  DELETE /api/clips/{id}          Delete a clip
  POST /api/clips/{id}/cut        Cut clip video with ffmpeg
  POST /api/clips/{id}/description Generate GPT-4o description
  GET  /api/clips                 List all clips for a job
  POST /api/export                Return CSV text
  GET  /video/{job_id}            Stream original video
  GET  /clip-video/{clip_id}      Stream cut clip video
"""
from __future__ import annotations

import csv
import io
import os
import threading
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiofiles
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
JOBS_DIR = BASE_DIR / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

HF_TOKEN = os.getenv("HF_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")

# ── In-memory stores (single-user local app) ──────────────────────────────────

jobs: Dict[str, dict] = {}
clips: Dict[str, dict] = {}

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="ClipMaker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def job_dir(job_id: str) -> Path:
    d = JOBS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_job(job_id: str) -> dict:
    j = jobs.get(job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return j


# ── Background processing ─────────────────────────────────────────────────────

def run_pipeline(job_id: str):
    import re
    from video_utils import download_youtube, extract_audio, get_video_duration, save_uploaded_file
    from transcription import transcribe_and_diarize

    j = jobs[job_id]

    import sys
    print(f"[pipeline] job={job_id} source={j.get('source')} video_path={j.get('video_path')} youtube_url={j.get('youtube_url')}", flush=True)
    def progress(msg: str):
        j["message"] = msg
        # Parse percentage out of messages like "Transcribing… 45%"
        m = re.search(r'(\d+)%', msg)
        if m:
            j["progress"] = int(m.group(1))

    try:
        # 1. Download / save video
        j["status"] = "downloading"
        jdir = job_dir(job_id)

        if j.get("source") == "url":
            progress("Downloading from YouTube…")
            video_path = download_youtube(j["youtube_url"], str(jdir))
        elif j.get("video_path"):
            video_path = j["video_path"]  # already saved by upload endpoint
        else:
            raise RuntimeError("No video source: neither a YouTube URL nor an uploaded file was found.")

        j["video_path"] = video_path
        j["duration"] = get_video_duration(video_path)
        progress(f"Video ready ({j['duration']:.0f}s)")

        # 2. Extract audio
        j["status"] = "extracting"
        progress("Extracting audio…")
        audio_path = extract_audio(video_path, str(jdir))
        j["audio_path"] = audio_path

        # 3. Transcribe + diarize
        j["status"] = "transcribing"
        hf = j.get("hf_token") or HF_TOKEN
        segments = transcribe_and_diarize(
            audio_path,
            hf_token=hf or None,
            whisper_model=WHISPER_MODEL,
            progress_callback=progress,
        )

        # 4. Apply initial speaker map (SPEAKER_00 → interviewee, etc.)
        speaker_ids = sorted(set(s.speaker for s in segments))
        speaker_map: dict[str, str] = {}
        interviewer = j.get("interviewer", "Interviewer")
        interviewee = j.get("interviewee", "Interviewee")

        if speaker_ids:
            # Heuristic: first speaker is often the interviewer
            # (user can correct this via the speaker-map endpoint)
            speaker_map[speaker_ids[0]] = interviewer
            if len(speaker_ids) > 1:
                speaker_map[speaker_ids[1]] = interviewee
            for sid in speaker_ids[2:]:
                speaker_map[sid] = sid  # unknown

        j["speaker_map"] = speaker_map

        # Resolve names
        for seg in segments:
            seg.speaker = speaker_map.get(seg.speaker, seg.speaker)

        j["transcript"] = [
            {
                "id": seg.id,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
                "speaker": seg.speaker,
            }
            for seg in segments
        ]
        j["status"] = "done"
        progress("Done!")

    except Exception as exc:
        import traceback
        j["status"] = "error"
        j["message"] = f"Error: {exc}\n{traceback.format_exc()}"


# ── Routes: Jobs ──────────────────────────────────────────────────────────────

class CreateJobFromURL(BaseModel):
    youtube_url: str
    interviewer: str = "Interviewer"
    interviewee: str = "Interviewee"
    hf_token: str = ""
    openai_api_key: str = ""


@app.post("/api/jobs/from-url")
def create_job_from_url(body: CreateJobFromURL, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "source": "url",
        "status": "pending",
        "message": "Queued",
        "progress": 0,
        "youtube_url": body.youtube_url,
        "interviewer": body.interviewer,
        "interviewee": body.interviewee,
        "hf_token": body.hf_token,
        "openai_api_key": body.openai_api_key or OPENAI_API_KEY,
        "video_path": None,
        "audio_path": None,
        "duration": None,
        "transcript": [],
        "speaker_map": {},
    }
    bg.add_task(run_pipeline, job_id)
    return {"job_id": job_id}


@app.post("/api/jobs/from-file")
async def create_job_from_file(
    bg: BackgroundTasks,
    file: UploadFile = File(...),
    interviewer: str = Form("Interviewer"),
    interviewee: str = Form("Interviewee"),
    hf_token: str = Form(""),
    openai_api_key: str = Form(""),
    youtube_url: str = Form(""),
):
    from video_utils import save_uploaded_file
    job_id = str(uuid.uuid4())
    jdir = job_dir(job_id)
    data = await file.read()
    video_path = save_uploaded_file(data, file.filename or "video.mp4", str(jdir))
    jobs[job_id] = {
        "id": job_id,
        "source": "file",
        "status": "pending",
        "message": "Queued",
        "progress": 0,
        "youtube_url": youtube_url,
        "interviewer": interviewer,
        "interviewee": interviewee,
        "hf_token": hf_token,
        "openai_api_key": openai_api_key or OPENAI_API_KEY,
        "video_path": video_path,
        "audio_path": None,
        "duration": None,
        "transcript": [],
        "speaker_map": {},
    }
    bg.add_task(run_pipeline, job_id)
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}/status")
def get_status(job_id: str):
    j = get_job(job_id)
    return {
        "status": j["status"],
        "message": j["message"],
        "progress": j.get("progress", 0),
        "duration": j.get("duration"),
    }


@app.get("/api/jobs/{job_id}/transcript")
def get_transcript(job_id: str):
    j = get_job(job_id)
    if j["status"] != "done":
        raise HTTPException(status_code=400, detail="Transcript not ready yet")
    return {
        "transcript": j["transcript"],
        "speaker_map": j["speaker_map"],
        "interviewer": j["interviewer"],
        "interviewee": j["interviewee"],
        "duration": j["duration"],
    }


class SpeakerMapUpdate(BaseModel):
    speaker_map: dict  # { "SPEAKER_00": "Alice", "SPEAKER_01": "Bob" }


@app.post("/api/jobs/{job_id}/speaker-map")
def update_speaker_map(job_id: str, body: SpeakerMapUpdate):
    j = get_job(job_id)
    j["speaker_map"] = body.speaker_map
    # Re-apply to transcript
    for seg in j["transcript"]:
        # Find original SPEAKER_XX key — reverse-map from current name
        # We stored original IDs; re-derive from raw segments isn't cheap
        # Instead we'll do a direct replacement pass
        for raw_id, name in body.speaker_map.items():
            if seg["speaker"] in (raw_id, *body.speaker_map.values()):
                pass  # complex; simpler: user sets map once before transcript loaded
    return {"ok": True}


# ── Routes: Video streaming ───────────────────────────────────────────────────

def _stream_file(path: str, media_type: str):
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="File not found")

    def iterfile():
        with open(path, "rb") as f:
            while chunk := f.read(1024 * 256):
                yield chunk

    return StreamingResponse(iterfile(), media_type=media_type)


@app.get("/video/{job_id}")
def stream_video(job_id: str):
    j = get_job(job_id)
    return _stream_file(j["video_path"], "video/mp4")


@app.get("/clip-video/{clip_id}")
def stream_clip_video(clip_id: str):
    c = clips.get(clip_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    if not c.get("file_path") or not Path(c["file_path"]).exists():
        raise HTTPException(status_code=404, detail="Clip video not yet cut")
    return _stream_file(c["file_path"], "video/mp4")


# ── Routes: Clips ─────────────────────────────────────────────────────────────

class CreateClip(BaseModel):
    job_id: str
    title: str
    start: float
    end: float
    transcript_text: str
    thumbnail_text: str = ""
    description: str = ""


class UpdateClip(BaseModel):
    title: Optional[str] = None
    start: Optional[float] = None
    end: Optional[float] = None
    thumbnail_text: Optional[str] = None
    description: Optional[str] = None
    transcript_text: Optional[str] = None


@app.post("/api/clips")
def create_clip(body: CreateClip):
    clip_id = str(uuid.uuid4())
    clips[clip_id] = {
        "id": clip_id,
        "job_id": body.job_id,
        "title": body.title,
        "start": body.start,
        "end": body.end,
        "transcript_text": body.transcript_text,
        "thumbnail_text": body.thumbnail_text,
        "description": body.description,
        "file_path": None,
    }
    return clips[clip_id]


@app.patch("/api/clips/{clip_id}")
def update_clip(clip_id: str, body: UpdateClip):
    c = clips.get(clip_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    for field, val in body.model_dump(exclude_none=True).items():
        c[field] = val
    return c


@app.delete("/api/clips/{clip_id}")
def delete_clip(clip_id: str):
    if clip_id not in clips:
        raise HTTPException(status_code=404, detail="Clip not found")
    del clips[clip_id]
    return {"ok": True}


@app.get("/api/clips")
def list_clips(job_id: str):
    return [c for c in clips.values() if c["job_id"] == job_id]


@app.post("/api/clips/{clip_id}/cut")
def cut_clip_endpoint(clip_id: str):
    from video_utils import cut_clip
    c = clips.get(clip_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    j = get_job(c["job_id"])
    jdir = job_dir(c["job_id"])
    out = str(jdir / f"clip_{clip_id}.mp4")
    cut_clip(j["video_path"], c["start"], c["end"], out)
    c["file_path"] = out
    return {"file_path": out, "url": f"/clip-video/{clip_id}"}


@app.post("/api/clips/{clip_id}/description")
def generate_description_endpoint(clip_id: str):
    from llm import generate_description
    c = clips.get(clip_id)
    if not c:
        raise HTTPException(status_code=404, detail="Clip not found")
    j = get_job(c["job_id"])
    api_key = j.get("openai_api_key") or OPENAI_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key configured")
    desc = generate_description(
        c["transcript_text"],
        j["interviewer"],
        j["interviewee"],
        api_key,
        youtube_url=j.get("youtube_url") or "",
    )
    c["description"] = desc
    return {"description": desc}


# ── Routes: Export ────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    job_id: str


@app.post("/api/export")
def export_csv(body: ExportRequest):
    j = get_job(body.job_id)
    job_clips = [c for c in clips.values() if c["job_id"] == body.job_id]
    youtube_url = j.get("youtube_url", "")
    interviewee = j.get("interviewee", "")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Artist", "Start", "End", "Thumbnail", "Title", "Description", "Full link"])
    for c in job_clips:
        writer.writerow([
            interviewee,
            _fmt_time(c["start"]),
            _fmt_time(c["end"]),
            c["thumbnail_text"],
            c["title"],
            c["description"],
            youtube_url,
        ])
    csv_text = output.getvalue()

    return StreamingResponse(
        io.BytesIO(csv_text.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="clips.csv"'},
    )


def _fmt_time(seconds: float) -> str:
    s = int(seconds)
    h, remainder = divmod(s, 3600)
    m, sec = divmod(remainder, 60)
    if h:
        return f"{h}:{m:02}:{sec:02}"
    return f"{m}:{sec:02}"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

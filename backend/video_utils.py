import os
import subprocess
from pathlib import Path

import ffmpeg


def download_youtube(url: str, output_dir: str) -> str:
    """Download a YouTube video using yt-dlp. Returns the path to the downloaded file."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_template = str(output_dir / "%(id)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        "--print", "after_move:filepath",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    video_path = result.stdout.strip().splitlines()[-1]
    return video_path


def save_uploaded_file(data: bytes, filename: str, output_dir: str) -> str:
    """Save an uploaded file to disk. Returns path."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    dest = output_dir / filename
    dest.write_bytes(data)
    return str(dest)


def extract_audio(video_path: str, output_dir: str) -> str:
    """Extract audio as 16kHz mono WAV for Whisper. Returns path to WAV file."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = str(output_dir / (Path(video_path).stem + ".wav"))

    (
        ffmpeg
        .input(video_path)
        .output(audio_path, ar=16000, ac=1, acodec="pcm_s16le")
        .overwrite_output()
        .run(quiet=True)
    )
    return audio_path


def get_video_duration(video_path: str) -> float:
    """Return duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def cut_clip(video_path: str, start: float, end: float, output_path: str) -> str:
    """Cut a clip from [start, end] seconds. Re-encodes for clean cuts. Returns output path."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    (
        ffmpeg
        .input(video_path, ss=start, to=end)
        .output(
            output_path,
            vcodec="libx264",
            acodec="aac",
            preset="fast",
            crf=23,
        )
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path

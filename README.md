# ClipMaker

A local web app for turning long-form interview videos into short clips — with AI transcription, speaker diarization, interactive editing, and CSV export.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend | FastAPI (Python) |
| Transcription | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) |
| Speaker ID | [pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) |
| Clip cutting | ffmpeg |
| Descriptions | OpenAI GPT-4o |
| YouTube download | yt-dlp |

## Prerequisites

- **Python 3.10+** and **pip**
- **Node.js 18+** and **npm**
- **ffmpeg** installed (`brew install ffmpeg` on macOS)
- **yt-dlp** installed (`brew install yt-dlp` or `pip install yt-dlp`)

## Setup

1. **Clone and configure**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **API keys in `.env`**
   - `OPENAI_API_KEY` — for GPT-4o clip descriptions (optional but recommended)
   - `HF_TOKEN` — for speaker diarization via pyannote.audio (optional)
     - Accept model terms at https://huggingface.co/pyannote/speaker-diarization-3.1

3. **Start everything**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   Then open **http://localhost:5173**

## Workflow

1. **Upload** — Paste a YouTube URL or choose a local video file. Enter interviewer and interviewee names.
2. **Process** — Whisper transcribes the audio; pyannote.audio identifies speakers. Takes a few minutes.
3. **Transcript** — Click a segment to start a selection, click another to end it. Hit **Create Clip**.
4. **Clips** — For each clip:
   - Drag the green/red markers on the timeline to fine-tune start/end times
   - Enter thumbnail text
   - Generate a description with GPT-4o (or write your own)
   - Click **Cut clip** to render the video segment
5. **Export** — Preview and download `clips.csv` with columns: `Artist | Start | End | Thumbnail | Title | Description | Full link`

## Notes

- All data is stored in memory and on disk under `backend/jobs/`. Nothing leaves your machine except API calls to OpenAI/HuggingFace.
- Speaker diarization can be skipped (no HF token needed) — speakers will show as `SPEAKER_00`, `SPEAKER_01` etc.
- Use `WHISPER_MODEL=base` for faster (less accurate) transcription, `large-v3` for best results.

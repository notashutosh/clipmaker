"""
Transcription + speaker diarization.

Pipeline:
  1. faster-whisper  → word-level transcript segments with timestamps
  2. pyannote.audio  → speaker diarization (who spoke when)
  3. Align           → attach speaker label to each segment
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional, Callable


@dataclass
class TranscriptSegment:
    id: int
    start: float
    end: float
    text: str
    speaker: str  # e.g. "SPEAKER_00" or resolved name


def _assign_speakers(
    segments: list[TranscriptSegment],
    diarization,  # pyannote Annotation object
) -> list[TranscriptSegment]:
    """For each segment, pick the speaker label with the most overlap."""
    try:
        from pyannote.core import Segment
    except ImportError:
        return segments  # pyannote not installed

    for seg in segments:
        span = Segment(seg.start, seg.end)
        overlap: dict[str, float] = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            o = turn & span
            if o:
                overlap[speaker] = overlap.get(speaker, 0.0) + o.duration
        if overlap:
            seg.speaker = max(overlap, key=lambda k: overlap[k])
    return segments


def transcribe_and_diarize(
    audio_path: str,
    hf_token: Optional[str] = None,
    whisper_model: str = "large-v3",
    progress_callback: Optional[Callable[[str], None]] = None,
) -> list[TranscriptSegment]:
    """
    Transcribe audio with faster-whisper and optionally diarize with pyannote.

    Args:
        audio_path: Path to 16kHz mono WAV file.
        hf_token: HuggingFace token for pyannote models. If None, diarization is skipped.
        whisper_model: Model size passed to faster_whisper.WhisperModel.
        progress_callback: Optional callable(message) for status updates.

    Returns:
        List of TranscriptSegment sorted by start time.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    # ── 1. Transcription ──────────────────────────────────────────────────────
    log("Loading Whisper model…")
    import whisper
    import whisper.transcribe as _wt
    import tqdm as _tqdm_module
    import tqdm.auto as _tqdm_auto
    from tqdm import tqdm as _real_tqdm

    # Patch tqdm at every level whisper might import it from
    class _ProgressTqdm(_real_tqdm):
        def update(self, n=1):
            super().update(n)
            if self.total and self.total > 0:
                pct = min(99, int(self.n / self.total * 100))
                log(f"Transcribing… {pct}%")

    model = whisper.load_model(whisper_model)

    log("Transcribing… 0%")
    # Patch all the places whisper might pull tqdm from
    _wt.tqdm = _ProgressTqdm
    _tqdm_module.tqdm = _ProgressTqdm
    _tqdm_auto.tqdm = _ProgressTqdm
    try:
        result = model.transcribe(audio_path, verbose=None)
    finally:
        _wt.tqdm = _real_tqdm
        _tqdm_module.tqdm = _real_tqdm
        _tqdm_auto.tqdm = _real_tqdm

    segments: list[TranscriptSegment] = []
    for i, seg in enumerate(result["segments"]):
        segments.append(
            TranscriptSegment(
                id=i,
                start=round(seg["start"], 3),
                end=round(seg["end"], 3),
                text=seg["text"].strip(),
                speaker="SPEAKER_00",  # default; overwritten below if diarization runs
            )
        )

    log(f"Transcription complete — {len(segments)} segments.")

    # ── 2. Diarization ────────────────────────────────────────────────────────
    if not hf_token:
        log("No HuggingFace token — skipping diarization.")
        return segments

    try:
        log("Running speaker diarization (pyannote.audio)…")
        from pyannote.audio import Pipeline
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        # Move to same device if possible
        if device == "cuda":
            import torch
            pipeline = pipeline.to(torch.device("cuda"))
        elif device == "mps":
            import torch
            pipeline = pipeline.to(torch.device("mps"))

        diarization = pipeline(audio_path)
        segments = _assign_speakers(segments, diarization)
        log("Diarization complete.")
    except Exception as exc:
        log(f"Diarization failed ({exc}) — speaker labels set to SPEAKER_00.")

    return segments

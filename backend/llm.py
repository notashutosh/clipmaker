"""Generate clip descriptions via OpenAI GPT-4o."""
from __future__ import annotations
from typing import Optional


def generate_description(
    transcript_text: str,
    interviewer: str,
    interviewee: str,
    api_key: str,
    youtube_url: str = "",
    model: str = "gpt-4o",
) -> str:
    """Return a formatted YouTube-style description for a clip."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    system = (
        "You are a YouTube content editor. Given a transcript excerpt from an interview, "
        "write a concise, engaging description (2–4 sentences) suitable for a short YouTube clip. "
        "Do not start with 'In this clip'. Write in third person. No hashtags."
    )
    user = (
        f"Interviewer: {interviewer}\n"
        f"Interviewee: {interviewee}\n\n"
        f"Transcript excerpt:\n{transcript_text}"
    )
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=200,
        temperature=0.7,
    )
    body = resp.choices[0].message.content.strip()

    header = f"Excerpt from interview with {interviewee} | {interviewer}"
    link_line = f"Link to full video: {youtube_url}" if youtube_url else ""
    parts = [header]
    if link_line:
        parts.append(link_line)
    parts.append("")
    parts.append(body)
    return "\n".join(parts)

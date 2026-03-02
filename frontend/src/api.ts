import type { Clip, JobStatusResponse, TranscriptResponse } from './types'

const BASE = '/api'

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function createJobFromURL(params: {
  youtube_url: string
  interviewer: string
  interviewee: string
  hf_token: string
  openai_api_key: string
}): Promise<{ job_id: string }> {
  const res = await fetch(`${BASE}/jobs/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createJobFromFile(params: {
  file: File
  interviewer: string
  interviewee: string
  hf_token: string
  openai_api_key: string
  youtube_url?: string
}): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('interviewer', params.interviewer)
  form.append('interviewee', params.interviewee)
  form.append('hf_token', params.hf_token)
  form.append('openai_api_key', params.openai_api_key)
  form.append('youtube_url', params.youtube_url ?? '')
  const res = await fetch(`${BASE}/jobs/from-file`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function pollStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${BASE}/jobs/${jobId}/status`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getTranscript(jobId: string): Promise<TranscriptResponse> {
  const res = await fetch(`${BASE}/jobs/${jobId}/transcript`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Clips ─────────────────────────────────────────────────────────────────────

export async function createClip(data: {
  job_id: string
  title: string
  start: number
  end: number
  transcript_text: string
  thumbnail_text?: string
  description?: string
}): Promise<Clip> {
  const res = await fetch(`${BASE}/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateClip(clipId: string, updates: Partial<Clip>): Promise<Clip> {
  const res = await fetch(`${BASE}/clips/${clipId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteClip(clipId: string): Promise<void> {
  const res = await fetch(`${BASE}/clips/${clipId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function listClips(jobId: string): Promise<Clip[]> {
  const res = await fetch(`${BASE}/clips?job_id=${jobId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function cutClip(clipId: string): Promise<{ url: string }> {
  const res = await fetch(`${BASE}/clips/${clipId}/cut`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function generateDescription(clipId: string): Promise<{ description: string }> {
  const res = await fetch(`${BASE}/clips/${clipId}/description`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function exportCsvUrl(jobId: string): string {
  return `${BASE}/export?job_id=${jobId}`
}

export async function exportCsv(jobId: string): Promise<void> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId }),
  })
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'clips.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function videoUrl(jobId: string): string {
  return `/video/${jobId}`
}

export function clipVideoUrl(clipId: string): string {
  return `/clip-video/${clipId}`
}

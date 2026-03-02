export type JobStatus =
  | 'pending'
  | 'downloading'
  | 'extracting'
  | 'transcribing'
  | 'done'
  | 'error'

export interface JobStatusResponse {
  status: JobStatus
  message: string
  progress: number
  duration: number | null
}

export interface TranscriptSegment {
  id: number
  start: number
  end: number
  text: string
  speaker: string
}

export interface TranscriptResponse {
  transcript: TranscriptSegment[]
  speaker_map: Record<string, string>
  interviewer: string
  interviewee: string
  duration: number
}

export interface Clip {
  id: string
  job_id: string
  title: string
  start: number
  end: number
  transcript_text: string
  thumbnail_text: string
  description: string
  file_path: string | null
}

export type AppStep = 'upload' | 'processing' | 'transcript' | 'clips' | 'export'

export interface AppState {
  step: AppStep
  jobId: string | null
  transcript: TranscriptSegment[]
  speakerMap: Record<string, string>
  interviewer: string
  interviewee: string
  videoDuration: number
  clips: Clip[]
}

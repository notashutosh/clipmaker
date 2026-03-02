import { useEffect, useState } from 'react'
import { pollStatus, getTranscript } from '../api'
import type { TranscriptSegment, JobStatus } from '../types'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  jobId: string
  onDone: (transcript: TranscriptSegment[], speakerMap: Record<string, string>, duration: number) => void
}

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Queued…',
  downloading: 'Downloading video…',
  extracting: 'Extracting audio…',
  transcribing: 'Transcribing (this may take several minutes)…',
  done: 'Done!',
  error: 'Error',
}

const STEPS: JobStatus[] = ['pending', 'downloading', 'extracting', 'transcribing', 'done']

export default function Processing({ jobId, onDone }: Props) {
  const [status, setStatus] = useState<JobStatus>('pending')
  const [message, setMessage] = useState('Queued…')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      while (!cancelled) {
        try {
          const s = await pollStatus(jobId)
          if (cancelled) return
          setStatus(s.status)
          setMessage(s.message)
          setProgress(s.progress ?? 0)
          setLog(prev => {
            const last = prev[prev.length - 1]
            return last === s.message ? prev : [...prev, s.message]
          })

          if (s.status === 'done') {
            const t = await getTranscript(jobId)
            onDone(t.transcript, t.speaker_map, t.duration)
            return
          }
          if (s.status === 'error') {
            setError(s.message)
            return
          }
        } catch (e) {
          if (!cancelled) setError(String(e))
          return
        }
        await sleep(2000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId])

  const currentStepIndex = STEPS.indexOf(status)

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-52px)] p-6">
      <div className="w-full max-w-md">
        <h2 className="text-xl font-semibold mb-6 text-center">Processing Video</h2>

        {/* Step indicators */}
        <div className="space-y-3 mb-8">
          {STEPS.filter(s => s !== 'pending').map((s, i) => {
            const stepI = STEPS.indexOf(s)
            const done = currentStepIndex > stepI
            const active = currentStepIndex === stepI
            const upcoming = currentStepIndex < stepI
            return (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                  done ? 'bg-green-600' : active ? 'bg-indigo-600' : 'bg-gray-800'
                }`}>
                  {done ? <CheckCircle size={16} /> : active ? <Loader2 size={14} className="animate-spin" /> : <span className="text-gray-600">{i + 1}</span>}
                </div>
                <span className={`text-sm ${done ? 'text-green-400' : active ? 'text-white' : 'text-gray-600'}`}>
                  {STATUS_LABELS[s]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Transcription progress bar */}
        {(status === 'transcribing' || (status === 'done' && progress > 0)) && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Transcription progress</span>
              <span>{status === 'done' ? 100 : progress}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${status === 'done' ? 100 : progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Live log */}
        <div className="bg-gray-900 rounded-lg p-4 min-h-[80px] max-h-48 overflow-y-auto font-mono text-xs text-gray-400">
          {log.map((l, i) => (
            <div key={i} className={i === log.length - 1 ? 'text-gray-200' : ''}>{l}</div>
          ))}
          {!log.length && <span className="text-gray-600">Waiting…</span>}
        </div>

        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-lg p-3 flex gap-2">
            <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <pre className="text-red-300 text-xs whitespace-pre-wrap">{error}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

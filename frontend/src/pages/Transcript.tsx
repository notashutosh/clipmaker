import { useState, useRef } from 'react'
import type { Clip, TranscriptSegment } from '../types'
import { videoUrl, createClip } from '../api'
import { Scissors, Play } from 'lucide-react'

interface Props {
  jobId: string
  transcript: TranscriptSegment[]
  speakerMap: Record<string, string>
  interviewer: string
  interviewee: string
  existingClips: Clip[]
  onClipsChange: (clips: Clip[]) => void
  onGoToClips: () => void
}

const SPEAKER_COLORS = [
  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'bg-purple-500/20 text-purple-300 border-purple-500/40',
]

const SEGMENT_SELECTION_COLORS = {
  start: 'bg-blue-600/30 border-l-2 border-blue-400',
  middle: 'bg-blue-600/20',
  end: 'bg-blue-600/30 border-r-2 border-blue-400',
  both: 'bg-blue-600/30 border-l-2 border-r-2 border-blue-400',
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function Transcript({
  jobId,
  transcript,
  speakerMap,
  interviewer,
  interviewee,
  existingClips,
  onClipsChange,
  onGoToClips,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [selStart, setSelStart] = useState<number | null>(null) // segment id
  const [selEnd, setSelEnd] = useState<number | null>(null)   // segment id
  const [clipTitle, setClipTitle] = useState('')
  const [creating, setCreating] = useState(false)

  // Build a stable speaker → color index mapping
  const speakers = Array.from(new Set(transcript.map(s => s.speaker)))
  const speakerColorMap = Object.fromEntries(
    speakers.map((sp, i) => [sp, SPEAKER_COLORS[i % SPEAKER_COLORS.length]])
  )

  const selStartIdx = selStart !== null ? transcript.findIndex(s => s.id === selStart) : -1
  const selEndIdx = selEnd !== null ? transcript.findIndex(s => s.id === selEnd) : -1
  const normalizedStart = selStartIdx !== -1 && selEndIdx !== -1 ? Math.min(selStartIdx, selEndIdx) : selStartIdx
  const normalizedEnd = selStartIdx !== -1 && selEndIdx !== -1 ? Math.max(selStartIdx, selEndIdx) : selEndIdx

  function handleSegmentClick(seg: TranscriptSegment) {
    // seek video
    if (videoRef.current) {
      videoRef.current.currentTime = seg.start
    }

    if (selStart === null) {
      setSelStart(seg.id)
      setSelEnd(null)
    } else if (selEnd === null && seg.id !== selStart) {
      setSelEnd(seg.id)
    } else {
      // reset and start new selection
      setSelStart(seg.id)
      setSelEnd(null)
    }
  }

  function getSegmentSelectionClass(idx: number): string {
    if (normalizedStart === -1) return ''
    if (normalizedEnd === -1) {
      return idx === normalizedStart ? SEGMENT_SELECTION_COLORS.start : ''
    }
    if (idx === normalizedStart && idx === normalizedEnd) return SEGMENT_SELECTION_COLORS.both
    if (idx === normalizedStart) return SEGMENT_SELECTION_COLORS.start
    if (idx === normalizedEnd) return SEGMENT_SELECTION_COLORS.end
    if (idx > normalizedStart && idx < normalizedEnd) return SEGMENT_SELECTION_COLORS.middle
    return ''
  }

  async function handleCreateClip() {
    if (normalizedStart === -1 || normalizedEnd === -1) return
    const segsInRange = transcript.slice(normalizedStart, normalizedEnd + 1)
    const start = segsInRange[0].start
    const end = segsInRange[segsInRange.length - 1].end
    const text = segsInRange.map(s => `${s.speaker}: ${s.text}`).join('\n')
    const title = clipTitle.trim() || `Clip ${existingClips.length + 1}`

    setCreating(true)
    try {
      const clip = await createClip({
        job_id: jobId,
        title,
        start,
        end,
        transcript_text: text,
      })
      onClipsChange([...existingClips, clip])
      setClipTitle('')
      setSelStart(null)
      setSelEnd(null)
    } finally {
      setCreating(false)
    }
  }

  const hasSelection = normalizedStart !== -1 && normalizedEnd !== -1 && normalizedStart !== normalizedEnd

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Left: Video + create clip panel */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-gray-800 bg-gray-950">
        <video
          ref={videoRef}
          src={videoUrl(jobId)}
          controls
          className="w-full bg-black"
          style={{ maxHeight: '240px' }}
        />

        {/* Clip creation */}
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-3">
            {!selStart
              ? 'Click segments in the transcript to select a range.'
              : !selEnd || normalizedStart === normalizedEnd
              ? 'Now click the end segment to complete the selection.'
              : `Selected ${normalizedEnd - normalizedStart + 1} segments · ${fmtTime(transcript[normalizedStart].start)} → ${fmtTime(transcript[normalizedEnd].end)}`}
          </p>
          <input
            value={clipTitle}
            onChange={e => setClipTitle(e.target.value)}
            placeholder={`Clip ${existingClips.length + 1} title…`}
            disabled={!hasSelection}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-sm mb-3 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            onClick={handleCreateClip}
            disabled={!hasSelection || creating}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            <Scissors size={14} />
            {creating ? 'Creating…' : 'Create Clip'}
          </button>
        </div>

        {/* Clip list sidebar */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Clips ({existingClips.length})
            </p>
            {existingClips.length > 0 && (
              <button
                onClick={onGoToClips}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Review →
              </button>
            )}
          </div>
          <div className="space-y-2">
            {existingClips.map(c => (
              <div key={c.id} className="bg-gray-900 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-200 truncate">{c.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {fmtTime(c.start)} → {fmtTime(c.end)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Transcript */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-base font-semibold text-gray-300 mb-4">
          Transcript — click a segment to start selection, click another to end it
        </h2>
        <div className="space-y-1">
          {transcript.map((seg, idx) => {
            const colorClass = speakerColorMap[seg.speaker] ?? SPEAKER_COLORS[0]
            const selClass = getSegmentSelectionClass(idx)
            return (
              <div
                key={seg.id}
                onClick={() => handleSegmentClick(seg)}
                className={`flex gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-900 transition-colors ${selClass}`}
              >
                <div className="flex-shrink-0 w-14 text-right">
                  <span className="text-[11px] text-gray-600 font-mono">{fmtTime(seg.start)}</span>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${colorClass} font-medium`}>
                    {seg.speaker}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{seg.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

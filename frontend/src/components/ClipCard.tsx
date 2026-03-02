import { useState } from 'react'
import type { Clip } from '../types'
import { updateClip, cutClip, generateDescription, deleteClip, videoUrl, clipVideoUrl } from '../api'
import VideoPlayer from './VideoPlayer'
import { Scissors, Wand2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  clip: Clip
  videoDuration: number
  jobId: string
  onUpdate: (clip: Clip) => void
  onDelete: (id: string) => void
}

export default function ClipCard({ clip, videoDuration, jobId, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [start, setStart] = useState(clip.start)
  const [end, setEnd] = useState(clip.end)
  const [title, setTitle] = useState(clip.title)
  const [thumbnail, setThumbnail] = useState(clip.thumbnail_text)
  const [description, setDescription] = useState(clip.description)
  const [saving, setSaving] = useState(false)
  const [cutting, setCutting] = useState(false)
  const [genDesc, setGenDesc] = useState(false)
  const [clipVideoSrc, setClipVideoSrc] = useState<string | null>(
    clip.file_path ? clipVideoUrl(clip.id) : null
  )
  const [dirty, setDirty] = useState(false)

  function markDirty() { setDirty(true) }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateClip(clip.id, { title, start, end, thumbnail_text: thumbnail, description })
      onUpdate(updated)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleCut() {
    // Save first to ensure latest times
    await updateClip(clip.id, { start, end })
    setCutting(true)
    try {
      const res = await cutClip(clip.id)
      setClipVideoSrc(res.url + '?t=' + Date.now())
      onUpdate({ ...clip, start, end, file_path: res.url })
    } finally {
      setCutting(false)
    }
  }

  async function handleGenerateDesc() {
    setGenDesc(true)
    try {
      const res = await generateDescription(clip.id)
      setDescription(res.description)
      markDirty()
    } finally {
      setGenDesc(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete clip "${title}"?`)) return
    await deleteClip(clip.id)
    onDelete(clip.id)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); markDirty() }}
          className="flex-1 bg-transparent text-white font-semibold focus:outline-none border-b border-transparent focus:border-gray-600"
        />
        <span className="text-xs text-gray-500 font-mono">
          {fmtTime(start)} → {fmtTime(end)} ({fmtTime(end - start)})
        </span>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-500 hover:text-white">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video player */}
          <div>
            <VideoPlayer
              src={clipVideoSrc ?? videoUrl(jobId)}
              startTime={start}
              endTime={end}
              duration={videoDuration}
              onStartChange={t => { setStart(t); markDirty() }}
              onEndChange={t => { setEnd(t); markDirty() }}
            />
            <button
              onClick={handleCut}
              disabled={cutting}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm py-2 rounded-lg transition-colors"
            >
              <Scissors size={13} />
              {cutting ? 'Cutting…' : clipVideoSrc ? 'Re-cut clip' : 'Cut clip'}
            </button>
            {clipVideoSrc && (
              <p className="text-[11px] text-green-400 text-center mt-1.5">✓ Clip cut successfully</p>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Thumbnail text</label>
              <input
                value={thumbnail}
                onChange={e => { setThumbnail(e.target.value); markDirty() }}
                placeholder="Short quote or hook…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Description</label>
                <button
                  onClick={handleGenerateDesc}
                  disabled={genDesc}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                >
                  <Wand2 size={11} />
                  {genDesc ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>
              <textarea
                value={description}
                onChange={e => { setDescription(e.target.value); markDirty() }}
                rows={4}
                placeholder="Description for this clip…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Transcript excerpt</label>
              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 max-h-28 overflow-y-auto font-mono whitespace-pre-wrap">
                {clip.transcript_text || '—'}
              </div>
            </div>

            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

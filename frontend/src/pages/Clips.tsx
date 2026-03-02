import type { Clip } from '../types'
import ClipCard from '../components/ClipCard'
import { ArrowLeft, ArrowRight, PlusCircle } from 'lucide-react'

interface Props {
  jobId: string
  clips: Clip[]
  videoDuration: number
  onClipsChange: (clips: Clip[]) => void
  onGoToTranscript: () => void
  onGoToExport: () => void
}

export default function Clips({ jobId, clips, videoDuration, onClipsChange, onGoToTranscript, onGoToExport }: Props) {
  const APPROX_DURATION = videoDuration || 99999

  function handleUpdate(updated: Clip) {
    onClipsChange(clips.map(c => (c.id === updated.id ? updated : c)))
  }

  function handleDelete(id: string) {
    onClipsChange(clips.filter(c => c.id !== id))
  }

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <button
          onClick={onGoToTranscript}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Transcript
        </button>
        <span className="text-gray-700">|</span>
        <span className="text-sm text-gray-300 font-medium">{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
        <button
          onClick={onGoToTranscript}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white ml-2 transition-colors"
        >
          <PlusCircle size={14} /> Add clip
        </button>
        <div className="flex-1" />
        <button
          onClick={onGoToExport}
          disabled={clips.length === 0}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          Export CSV <ArrowRight size={14} />
        </button>
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto p-6">
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <p className="text-lg mb-2">No clips yet</p>
            <button onClick={onGoToTranscript} className="text-indigo-400 hover:text-indigo-300 text-sm">
              Go to transcript to create clips →
            </button>
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto">
            {clips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                videoDuration={APPROX_DURATION}
                jobId={jobId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

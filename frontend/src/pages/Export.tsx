import type { Clip } from '../types'
import { exportCsv } from '../api'
import { ArrowLeft, Download } from 'lucide-react'
import { useState } from 'react'

interface Props {
  jobId: string
  clips: Clip[]
  interviewee: string
  onBack: () => void
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function Export({ jobId, clips, interviewee, onBack }: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleExport() {
    setDownloading(true)
    try {
      await exportCsv(jobId)
    } finally {
      setDownloading(false)
    }
  }

  const HEADERS = ['Artist', 'Start', 'End', 'Thumbnail', 'Title', 'Description', 'Full link']

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Back to clips
        </button>
        <div className="flex-1" />
        <button
          onClick={handleExport}
          disabled={downloading || clips.length === 0}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          <Download size={14} />
          {downloading ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {/* Preview table */}
      <div className="flex-1 overflow-auto p-6">
        <h2 className="text-base font-semibold mb-4 text-gray-300">
          CSV Preview — {clips.length} clip{clips.length !== 1 ? 's' : ''}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                {HEADERS.map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clips.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}`}
                >
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{interviewee}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap">{fmtTime(c.start)}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap">{fmtTime(c.end)}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate">{c.thumbnail_text || '—'}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium max-w-[200px] truncate">{c.title}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[300px]">
                    <span className="line-clamp-2">{c.description || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-indigo-400 max-w-[180px] truncate text-xs font-mono">
                    {/* Full link stored in backend; shown as job hint */}
                    (from job)
                  </td>
                </tr>
              ))}
              {clips.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                    No clips yet. Go back and create some.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

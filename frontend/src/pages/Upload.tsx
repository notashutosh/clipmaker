import { useState, useRef } from 'react'
import { createJobFromURL, createJobFromFile } from '../api'
import { Link, Upload as UploadIcon, Youtube } from 'lucide-react'

interface Props {
  onJobCreated: (jobId: string, interviewer: string, interviewee: string) => void
}

export default function Upload({ onJobCreated }: Props) {
  const [tab, setTab] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [fileYoutubeUrl, setFileYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [interviewer, setInterviewer] = useState('')
  const [interviewee, setInterviewee] = useState('')
  const [hfToken, setHfToken] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!interviewer.trim() || !interviewee.trim()) {
      setError('Please enter both interviewer and interviewee names.')
      return
    }
    setLoading(true)
    try {
      let result: { job_id: string }
      if (tab === 'url') {
        if (!url.trim()) throw new Error('Please enter a YouTube URL.')
        result = await createJobFromURL({
          youtube_url: url.trim(),
          interviewer: interviewer.trim(),
          interviewee: interviewee.trim(),
          hf_token: hfToken.trim(),
          openai_api_key: openaiKey.trim(),
        })
      } else {
        if (!file) throw new Error('Please select a video file.')
        result = await createJobFromFile({
          file,
          interviewer: interviewer.trim(),
          interviewee: interviewee.trim(),
          hf_token: hfToken.trim(),
          openai_api_key: openaiKey.trim(),
          youtube_url: fileYoutubeUrl.trim(),
        })
      }
      onJobCreated(result.job_id, interviewer.trim(), interviewee.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-52px)] p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">New Interview</h1>

        {/* Source tabs */}
        <div className="flex rounded-lg bg-gray-900 p-1 mb-6 gap-1">
          <button
            onClick={() => setTab('url')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'url' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Youtube size={16} /> YouTube URL
          </button>
          <button
            onClick={() => setTab('file')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'file' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <UploadIcon size={16} /> Local File
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Video source */}
          {tab === 'url' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">YouTube URL</label>
              <div className="relative">
                <Link size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Video File</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                >
                  {file ? (
                    <p className="text-sm text-indigo-300">{file.name}</p>
                  ) : (
                    <>
                      <UploadIcon size={24} className="mx-auto mb-2 text-gray-500" />
                      <p className="text-sm text-gray-400">Click to select MP4 / MOV / MKV</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  YouTube link <span className="text-gray-600">(used in descriptions &amp; export)</span>
                </label>
                <div className="relative">
                  <Link size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="url"
                    value={fileYoutubeUrl}
                    onChange={e => setFileYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Interviewer name</label>
              <input
                value={interviewer}
                onChange={e => setInterviewer(e.target.value)}
                placeholder="e.g. Lex Fridman"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Interviewee name</label>
              <input
                value={interviewee}
                onChange={e => setInterviewee(e.target.value)}
                placeholder="e.g. Sam Altman"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Optional tokens */}
          <details className="group">
            <summary className="text-sm text-gray-400 cursor-pointer select-none hover:text-white list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              API keys (optional — override .env)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">OpenAI API key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  HuggingFace token{' '}
                  <span className="text-gray-600">(for speaker diarization)</span>
                </label>
                <input
                  type="password"
                  value={hfToken}
                  onChange={e => setHfToken(e.target.value)}
                  placeholder="hf_..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </details>

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Starting…' : 'Process Video →'}
          </button>
        </form>
      </div>
    </div>
  )
}

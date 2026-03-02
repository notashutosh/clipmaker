import { useState } from 'react'
import type { AppState, AppStep, Clip } from './types'
import Upload from './pages/Upload'
import Processing from './pages/Processing'
import Transcript from './pages/Transcript'
import Clips from './pages/Clips'
import Export from './pages/Export'
import { Scissors } from 'lucide-react'

const STEPS: { key: AppStep; label: string }[] = [
  { key: 'upload', label: '1. Upload' },
  { key: 'processing', label: '2. Process' },
  { key: 'transcript', label: '3. Transcript' },
  { key: 'clips', label: '4. Clips' },
  { key: 'export', label: '5. Export' },
]

const STEP_ORDER: AppStep[] = ['upload', 'processing', 'transcript', 'clips', 'export']

export default function App() {
  const [state, setState] = useState<AppState>({
    step: 'upload',
    jobId: null,
    transcript: [],
    speakerMap: {},
    interviewer: '',
    interviewee: '',
    videoDuration: 0,
    clips: [],
  })

  const setStep = (step: AppStep) => setState(s => ({ ...s, step }))

  const stepIndex = STEP_ORDER.indexOf(state.step)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Scissors className="text-indigo-400" size={22} />
        <span className="text-lg font-semibold tracking-tight">ClipMaker</span>
        <nav className="ml-6 flex gap-1">
          {STEPS.map((s, i) => {
            const done = i < stepIndex
            const active = s.key === state.step
            const disabled = i > stepIndex
            return (
              <button
                key={s.key}
                disabled={disabled}
                onClick={() => !disabled && setStep(s.key)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : done
                    ? 'text-gray-300 hover:text-white hover:bg-gray-800'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {state.step === 'upload' && (
          <Upload
            onJobCreated={(jobId, interviewer, interviewee) => {
              setState(s => ({ ...s, jobId, interviewer, interviewee, step: 'processing' }))
            }}
          />
        )}

        {state.step === 'processing' && state.jobId && (
          <Processing
            jobId={state.jobId}
            onDone={(transcript, speakerMap, duration) => {
              setState(s => ({
                ...s,
                transcript,
                speakerMap,
                videoDuration: duration,
                step: 'transcript',
              }))
            }}
          />
        )}

        {state.step === 'transcript' && state.jobId && (
          <Transcript
            jobId={state.jobId}
            transcript={state.transcript}
            speakerMap={state.speakerMap}
            interviewer={state.interviewer}
            interviewee={state.interviewee}
            existingClips={state.clips}
            onClipsChange={clips => setState(s => ({ ...s, clips }))}
            onGoToClips={() => setStep('clips')}
          />
        )}

        {state.step === 'clips' && state.jobId && (
          <Clips
            jobId={state.jobId}
            clips={state.clips}
            videoDuration={state.videoDuration}
            onClipsChange={clips => setState(s => ({ ...s, clips }))}
            onGoToTranscript={() => setStep('transcript')}
            onGoToExport={() => setStep('export')}
          />
        )}

        {state.step === 'export' && state.jobId && (
          <Export
            jobId={state.jobId}
            clips={state.clips}
            interviewee={state.interviewee}
            onBack={() => setStep('clips')}
          />
        )}
      </main>
    </div>
  )
}

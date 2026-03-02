import { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

interface Props {
  src: string
  startTime: number
  endTime: number
  duration: number
  onStartChange: (t: number) => void
  onEndChange: (t: number) => void
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`
}

export default function VideoPlayer({
  src,
  startTime,
  endTime,
  duration,
  onStartChange,
  onEndChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(startTime)
  const dragging = useRef<'start' | 'end' | 'playhead' | null>(null)

  // Seek to startTime when src changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime
      setCurrentTime(startTime)
    }
  }, [src])

  // Loop between startTime and endTime
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    function onTimeUpdate() {
      if (!v) return
      setCurrentTime(v.currentTime)
      if (v.currentTime >= endTime) {
        v.currentTime = startTime
        if (!v.paused) v.play()
      }
    }
    v.addEventListener('timeupdate', onTimeUpdate)
    return () => v.removeEventListener('timeupdate', onTimeUpdate)
  }, [startTime, endTime])

  function pxToTime(clientX: number): number {
    const rect = timelineRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const handleMouseDown = useCallback(
    (type: 'start' | 'end' | 'playhead') =>
      (e: React.MouseEvent) => {
        e.preventDefault()
        dragging.current = type
      },
    []
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !timelineRef.current) return
      const t = pxToTime(e.clientX)
      if (dragging.current === 'start') {
        const clamped = Math.max(0, Math.min(t, endTime - 0.5))
        onStartChange(Math.round(clamped * 10) / 10)
        if (videoRef.current) videoRef.current.currentTime = clamped
      } else if (dragging.current === 'end') {
        const clamped = Math.min(duration, Math.max(t, startTime + 0.5))
        onEndChange(Math.round(clamped * 10) / 10)
      } else if (dragging.current === 'playhead') {
        const clamped = Math.max(startTime, Math.min(endTime, t))
        if (videoRef.current) videoRef.current.currentTime = clamped
      }
    }
    function onUp() { dragging.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [duration, startTime, endTime, onStartChange, onEndChange])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime >= endTime || v.currentTime < startTime) {
        v.currentTime = startTime
      }
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  // Positions as percentages
  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="select-none">
      <video
        ref={videoRef}
        src={src}
        className="w-full rounded-lg bg-black"
        style={{ maxHeight: '280px' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3 mt-2 mb-1 px-1">
        <button
          onClick={togglePlay}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => { if (videoRef.current) videoRef.current.currentTime = startTime }}
          className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
        >
          <RotateCcw size={12} />
        </button>
        <span className="text-xs font-mono text-gray-400 ml-auto">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="relative h-8 bg-gray-900 rounded cursor-pointer"
        onClick={e => {
          if (dragging.current) return
          const t = pxToTime(e.clientX)
          const clamped = Math.max(startTime, Math.min(endTime, t))
          if (videoRef.current) videoRef.current.currentTime = clamped
        }}
      >
        {/* Full track */}
        <div className="absolute inset-0 rounded bg-gray-800" />

        {/* Clip region */}
        <div
          className="absolute top-0 bottom-0 bg-indigo-800/50"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 cursor-ew-resize z-10"
          style={{ left: `calc(${playPct}% - 1px)` }}
          onMouseDown={handleMouseDown('playhead')}
        />

        {/* Start marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-20"
          style={{ left: `calc(${startPct}% - 8px)`, width: '16px' }}
          onMouseDown={handleMouseDown('start')}
        >
          <div className="w-3 h-full bg-green-500 rounded-sm opacity-90 hover:opacity-100 relative">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-green-700 text-white text-[10px] font-mono px-1 rounded whitespace-nowrap pointer-events-none">
              {fmtTime(startTime)}
            </div>
          </div>
        </div>

        {/* End marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-20"
          style={{ left: `calc(${endPct}% - 8px)`, width: '16px' }}
          onMouseDown={handleMouseDown('end')}
        >
          <div className="w-3 h-full bg-red-500 rounded-sm opacity-90 hover:opacity-100 relative">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-700 text-white text-[10px] font-mono px-1 rounded whitespace-nowrap pointer-events-none">
              {fmtTime(endTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Numeric inputs for precise editing */}
      <div className="flex gap-4 mt-3 text-xs">
        <label className="flex items-center gap-2 flex-1">
          <span className="text-green-400 font-medium w-8">Start</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={endTime - 0.1}
            value={startTime}
            onChange={e => onStartChange(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 font-mono focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-500">s</span>
        </label>
        <label className="flex items-center gap-2 flex-1">
          <span className="text-red-400 font-medium w-8">End</span>
          <input
            type="number"
            step="0.1"
            min={startTime + 0.1}
            max={duration}
            value={endTime}
            onChange={e => onEndChange(parseFloat(e.target.value) || 0)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 font-mono focus:outline-none focus:border-red-500"
          />
          <span className="text-gray-500">s</span>
        </label>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Film, Mic } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { clipSrc } from './clipStore'
import { cn } from '../../lib/utils'

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Streams a Clip from the server. */
export default function ClipPlayer({ clipId, compact, className }: { clipId: string; compact?: boolean; className?: string }) {
  const clip = useStore((s) => s.clips.find((c) => c.id === clipId))
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    setMissing(false)
    void clipSrc(clipId).then((src) => alive && setUrl(src))
    return () => {
      alive = false
    }
  }, [clipId])

  if (!clip) return <div className="text-faint text-xs">Clip was deleted.</div>
  const audioOnly = clip.mime.startsWith('audio')
  return (
    <div className={cn('overflow-hidden rounded-lg bg-black', compact ? 'max-w-sm' : '', className)}>
      {missing ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-stone-800 p-4 text-center text-xs text-white/70">
          {audioOnly ? <Mic size={22} /> : <Film size={22} />}
          This recording couldn’t be loaded.
        </div>
      ) : url ? (
        audioOnly ? (
          <audio src={url} controls onError={() => setMissing(true)} className="w-full" />
        ) : (
          <video src={url} controls playsInline onError={() => setMissing(true)} className="aspect-video w-full bg-black" />
        )
      ) : (
        <div className="flex aspect-video items-center justify-center text-xs text-white/50">Loading…</div>
      )}
    </div>
  )
}

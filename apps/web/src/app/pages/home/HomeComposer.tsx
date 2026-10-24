import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Bot, CalendarPlus, CheckSquare, ClipboardList, FileText, Film, Layers, LayoutDashboard, List as ListIcon, Mic, PenTool, Sparkles, type LucideIcon } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { useAssistant } from '../../ai/useAssistant'
import { useRecorder } from '../../clips/Recorder'
import { cn } from '../../../lib/utils'

const SUGGESTIONS = ['Break my next task into steps', 'What should I focus on today?', 'Draft a project brief for my current project', 'Summarize what changed in my tasks this week']

/** ClickUp-style "What should we work on?" box: ask the assistant, or create something in one click. */
export default function HomeComposer({ onMeeting }: { onMeeting: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const firstList = s.lists[0]?.id
  const firstSpace = s.spaces[0]?.id

  const ask = (prompt: string) => {
    if (!prompt.trim()) return
    useAssistant.getState().ask(prompt.trim())
    setText('')
  }
  // Browser speech recognition, where available (Chrome, Edge, Safari).
  const dictate = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SR) return s.toast('Voice input is not supported in this browser', 'error')
    const rec = new SR()
    rec.lang = navigator.language
    rec.interimResults = false
    rec.onresult = (e) => setText((t) => `${t}${t ? ' ' : ''}${e.results[0][0].transcript}`)
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const name = (what: string) => window.prompt(`Name your new ${what}`)?.trim()
  const create: { label: string; icon: LucideIcon; color: string; run: () => void }[] = [
    { label: 'Task', icon: CheckSquare, color: '#0b7f71', run: () => firstList && s.openTask(s.addTask({ listId: firstList, title: 'New task', assignees: s.currentUserId ? [s.currentUserId] : [] })) },
    { label: 'List', icon: ListIcon, color: '#2563eb', run: () => { const n = firstSpace && name('List'); if (n && firstSpace) nav(`/app/list/${s.addList(firstSpace, null, n)}`) } },
    { label: 'Space', icon: Layers, color: '#7c3aed', run: () => { const n = name('space'); if (n) nav(`/app/space/${s.addSpace(n)}`) } },
    { label: 'Doc', icon: FileText, color: '#0891b2', run: () => nav(`/app/docs/${s.addDoc(null)}`) },
    { label: 'Dashboard', icon: LayoutDashboard, color: '#db2777', run: () => nav('/app/dashboards') },
    { label: 'Form', icon: ClipboardList, color: '#7c3aed', run: () => firstList && nav(`/app/forms/${s.addForm(firstList)}`) },
    { label: 'Whiteboard', icon: PenTool, color: '#d97706', run: () => nav(`/app/whiteboards/${s.addWhiteboard()}`) },
    { label: 'Agent', icon: Bot, color: '#f45f2f', run: () => nav('/app/ai?view=agents') },
    { label: 'Meeting', icon: CalendarPlus, color: '#16a34a', run: onMeeting },
    { label: 'Clip', icon: Film, color: '#dc2626', run: () => useRecorder.getState().open({ mode: 'screen+camera' }) },
  ]

  return (
    <section className="mx-auto mb-8 max-w-3xl">
      <h2 className="font-display mb-4 flex items-center justify-center gap-2 text-center text-2xl font-semibold">
        <Sparkles size={22} className="text-brand-600" /> What should we work on?
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
        className="surface rounded-2xl border border-[var(--border)] p-3 shadow-[var(--shadow-pop)] focus-within:border-[var(--color-brand-400)]"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(text)
            }
          }}
          rows={2}
          placeholder="From idea to finished work. Ask anything, or describe what to create…"
          className="w-full resize-none bg-transparent px-1 text-[15px] outline-none placeholder:text-[var(--text-faint)]"
          aria-label="Ask the assistant"
        />
        <div className="flex items-center gap-1">
          <span className="text-faint text-xs">The assistant can read and update your tasks, docs and lists.</span>
          <button type="button" onClick={dictate} className={cn('hover-surface ml-auto rounded-full p-2', listening ? 'text-accent-600 animate-pulse' : 'text-muted')} aria-label="Talk to text" title="Talk to text">
            <Mic size={16} />
          </button>
          <button disabled={!text.trim()} className="bg-brand-600 hover:bg-brand-700 rounded-full p-2 text-white disabled:opacity-40" aria-label="Ask">
            <ArrowUp size={16} />
          </button>
        </div>
      </form>

      <div className="mt-5">
        <div className="text-faint mb-2 text-xs font-medium">Start with</div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {create.map(({ label, icon: Icon, color, run }) => (
            <button key={label} onClick={run} className="group flex w-16 shrink-0 flex-col items-center gap-1 text-[11px]" title={`Create ${label.toLowerCase()}`}>
              <span className="border-app surface flex h-11 w-11 items-center justify-center rounded-xl border transition-transform group-hover:-translate-y-0.5 group-hover:shadow-sm">
                <Icon size={18} style={{ color }} />
              </span>
              <span className="text-muted group-hover:text-app">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((p) => (
          <button key={p} onClick={() => ask(p)} className="border-app hover-surface text-muted hover:text-app inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
            <Sparkles size={12} className="text-brand-600" /> {p}
          </button>
        ))}
      </div>
    </section>
  )
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void
  onend: () => void
  start: () => void
}

import { useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { CheckSquare, ImagePlus, Search, Upload } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Modal } from '../components/ui'
import { useDocUi } from './slash'
import { cn } from '../../lib/utils'

const MAX_IMAGE_BYTES = 600 * 1024

/** Shrinks an image file to fit inside a doc (docs are stored as HTML, capped at 2 MiB). */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 600 KB for GIF/SVG).')
    return await new Promise((ok, fail) => {
      const r = new FileReader()
      r.onload = () => ok(r.result as string)
      r.onerror = () => fail(new Error('Could not read the image.'))
      r.readAsDataURL(file)
    })
  }
  const bmp = await createImageBitmap(file)
  for (const max of [1600, 1200, 900]) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) })
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/webp', 0.82)
    if (url.length * 0.75 <= MAX_IMAGE_BYTES) return url
  }
  throw new Error('Image is too large even after resizing.')
}

export function insertImage(editor: Editor, file: File, onError: (m: string) => void) {
  imageToDataUrl(file).then(
    (src) => editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run(),
    (e: Error) => onError(e.message),
  )
}

function TaskPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks)
  const lists = useStore((s) => s.lists)
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const results = useMemo(() => {
    const needle = q.toLowerCase().replace(/^ms-/, '')
    return tasks.filter((t) => !needle || t.title.toLowerCase().includes(needle) || String(t.key).startsWith(needle)).slice(0, 30)
  }, [tasks, q])
  const pick = (i: number) => {
    const t = results[i]
    if (!t) return
    editor
      .chain()
      .focus()
      .insertContent([{ type: 'text', text: `MS-${t.key} ${t.title}`, marks: [{ type: 'link', attrs: { href: `/app/t/${t.id}`, target: null, class: 'task-link' } }] }, { type: 'text', text: ' ' }])
      .run()
    onClose()
  }
  return (
    <div>
      <div className="border-app flex items-center gap-2 border-b px-3">
        <Search size={15} className="text-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => (setQ(e.target.value), setIndex(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setIndex((i) => Math.min(i + 1, results.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setIndex((i) => Math.max(i - 1, 0)))
            if (e.key === 'Enter') (e.preventDefault(), pick(index))
          }}
          placeholder="Search tasks by name or MS-number"
          className="h-11 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5 scroll-thin">
        {results.length === 0 && <p className="text-muted px-2 py-6 text-center text-sm">No tasks match.</p>}
        {results.map((t, i) => (
          <button key={t.id} onMouseEnter={() => setIndex(i)} onClick={() => pick(i)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', i === index && 'bg-brand-50 dark:bg-brand-500/15')}>
            <CheckSquare size={14} className="text-muted shrink-0" />
            <span className="text-faint shrink-0 font-mono text-xs">MS-{t.key}</span>
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="text-faint shrink-0 truncate text-xs">{lists.find((l) => l.id === t.listId)?.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ImagePicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const fromFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      const src = await imageToDataUrl(f)
      editor.chain().focus().setImage({ src, alt: f.name.replace(/\.[^.]+$/, '') }).run()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <ImagePlus size={17} /> Add an image
      </h2>
      <button
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), void fromFile(e.dataTransfer.files[0]))}
        className="border-app hover:border-brand-500 flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed py-6 text-sm"
      >
        <Upload size={18} className="text-muted" />
        <span className="font-medium">{busy ? 'Processing…' : 'Upload or drop an image'}</span>
        <span className="text-faint text-xs">Large images are resized to fit</span>
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void fromFile(e.target.files?.[0])} />
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!/^https?:\/\//.test(url.trim())) return setError('Enter an http(s) image link.')
          editor.chain().focus().setImage({ src: url.trim() }).run()
          onClose()
        }}
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image link" className="border-app surface-subtle min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-sm outline-none" />
        <button disabled={!url.trim()} className="bg-brand-600 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50">
          Insert
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Dialogs the toolbar and "/" menu ask for. */
export function InsertDialogs() {
  const { request, done } = useDocUi()
  return (
    <Modal open={!!request} onClose={done} className="mt-[12vh] max-w-lg">
      {request?.kind === 'task' && <TaskPicker editor={request.editor} onClose={done} />}
      {request?.kind === 'image' && <ImagePicker editor={request.editor} onClose={done} />}
    </Modal>
  )
}

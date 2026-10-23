import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Workspace } from '../store/types'
import { Popover, usePopover } from './components/ui'
import { cn } from '../lib/utils'

export function WorkspaceBadge({ ws, size = 22 }: { ws: Workspace; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white" style={{ width: size, height: size, background: ws.color, fontSize: size * 0.5 }}>
      {ws.name[0]?.toUpperCase()}
    </span>
  )
}

export default function WorkspaceSwitcher() {
  const { workspaces, currentWorkspaceId, switchWorkspace, addWorkspace, renameWorkspace, deleteWorkspace, tasks, spaces } = useStore()
  const pop = usePopover()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const current = workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]

  // Only the active workspace is loaded; others show their member count.
  const stats = (id: string) => {
    if (id === currentWorkspaceId) return `${spaces.length} project${spaces.length === 1 ? '' : 's'} · ${tasks.filter((t) => !t.parentId).length} tasks`
    const n = workspaces.find((w) => w.id === id)?.members.length ?? 0
    return `${n} member${n === 1 ? '' : 's'}`
  }

  const go = (id: string) => {
    switchWorkspace(id)
    pop.close()
    nav('/app/home')
  }

  if (!current) return null
  return (
    <>
      <button onClick={pop.toggle} className="hover-surface flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1" aria-label="Switch workspace">
        <WorkspaceBadge ws={current} />
        <span className="hidden max-w-40 truncate text-sm font-semibold sm:inline">{current.name}</span>
        <ChevronsUpDown size={14} className="text-faint hidden sm:block" />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={() => (pop.close(), setCreating(false), setRenaming(null))} width={300}>
        <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase">Workspaces</div>
        {workspaces.map((w) => (
          <div key={w.id} className="group hover-surface flex items-center gap-2 rounded-md px-2 py-1.5">
            {renaming === w.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = (new FormData(e.currentTarget).get('name') as string).trim()
                  if (v) renameWorkspace(w.id, v)
                  setRenaming(null)
                }}
              >
                <WorkspaceBadge ws={w} size={26} />
                <input name="name" autoFocus defaultValue={w.name} onBlur={(e) => e.currentTarget.form?.requestSubmit()} className="border-brand-500 min-w-0 flex-1 rounded border bg-transparent px-1.5 py-0.5 outline-none" />
              </form>
            ) : (
              <>
                <button onClick={() => go(w.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <WorkspaceBadge ws={w} size={26} />
                  <span className="min-w-0">
                    <span className={cn('block truncate', w.id === currentWorkspaceId && 'font-semibold')}>{w.name}</span>
                    <span className="text-faint block truncate text-[11px]">{stats(w.id)}</span>
                  </span>
                </button>
                <button onClick={() => setRenaming(w.id)} className="text-faint hidden rounded p-1 group-hover:block hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Rename ${w.name}`}>
                  <Pencil size={13} />
                </button>
                {workspaces.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete workspace “${w.name}” and everything in it? This cannot be undone.`)) {
                        deleteWorkspace(w.id)
                        nav('/app/home')
                      }
                    }}
                    className="hidden rounded p-1 text-red-500 group-hover:block hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label={`Delete ${w.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {w.id === currentWorkspaceId && <Check size={15} className="text-brand-600 shrink-0" />}
              </>
            )}
          </div>
        ))}
        <div className="border-app my-1 border-t" />
        {creating ? (
          <form
            className="flex items-center gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              addWorkspace(name.trim())
              setName('')
              setCreating(false)
              pop.close()
              nav('/app/home')
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" className="border-app min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1.5 outline-none" />
            <button className="bg-brand-600 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40" disabled={!name.trim()}>
              Create
            </button>
          </form>
        ) : (
          <button onClick={() => setCreating(true)} className="hover-surface flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left">
            <span className="border-app flex h-[26px] w-[26px] items-center justify-center rounded-md border border-dashed">
              <Plus size={14} />
            </span>
            New workspace
          </button>
        )}
      </Popover>
    </>
  )
}

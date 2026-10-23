import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { CheckSquare, Folder as FolderIcon, LayoutDashboard, LayoutTemplate, List as ListIcon, Plus } from 'lucide-react'
import { TemplatePicker } from '../components/Dialogs'
import { useStore } from '../../store/useStore'
import ViewHost from '../views/ViewHost'
import { InlineEdit } from '../components/ui'
import { SPACE_COLORS, cn } from '../../lib/utils'
import { useQueryState } from '../../lib/useQueryState'
import SpaceOverview from './SpaceOverview'

export default function SpacePage() {
  const { spaceId = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const [tpl, setTpl] = useState(false)
  const [tab, setTab] = useQueryState<'overview' | 'tasks'>('tab', 'overview')
  const space = s.spaces.find((sp) => sp.id === spaceId)
  if (!space) return s.status === 'ready' && s.spaces.length ? <Navigate to="/app/everything" replace /> : null
  const lists = s.lists.filter((l) => l.spaceId === spaceId)
  const listIds = new Set(lists.map((l) => l.id))
  const tasks = s.tasks.filter((t) => listIds.has(t.listId))
  const top = tasks.filter((t) => !t.parentId)
  const done = top.filter((t) => space.statuses.find((st) => st.id === t.statusId)?.type === 'done').length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white" style={{ background: space.color }}>
          {space.name[0]}
        </span>
        <InlineEdit value={space.name} onSave={(v) => s.updateSpace(spaceId, { name: v })} className="text-lg font-semibold" />
        <div className="flex gap-1">
          {SPACE_COLORS.map((c) => (
            <button key={c} onClick={() => s.updateSpace(spaceId, { color: c })} className={cn('h-4 w-4 rounded-full', c === space.color && 'ring-2 ring-offset-1 ring-offset-[var(--bg)]')} style={{ background: c, ['--tw-ring-color' as string]: c }} aria-label={`Color ${c}`} />
          ))}
        </div>
        <div className="text-muted ml-auto flex items-center gap-3 text-xs">
          <span>
            {done}/{top.length} complete
          </span>
          <div className="surface-muted h-1.5 w-28 overflow-hidden rounded-full">
            <div className="h-full bg-emerald-500" style={{ width: `${top.length ? (done / top.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="border-app mt-2 flex items-center gap-1 border-b px-4">
        {(
          [
            ['overview', 'Overview', LayoutDashboard],
            ['tasks', 'Tasks', CheckSquare],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium',
              tab === k ? 'text-app after:bg-brand-600 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full' : 'text-muted hover:text-app',
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <div className="min-h-0 flex-1">
          <SpaceOverview space={space} />
        </div>
      ) : (
        <>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {lists.map((l) => {
          const folder = s.folders.find((f) => f.id === l.folderId)
          const n = s.tasks.filter((t) => t.listId === l.id && !t.parentId).length
          return (
            <Link key={l.id} to={`/app/list/${l.id}`} className="border-app hover-surface flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              {folder ? <FolderIcon size={14} className="text-muted" /> : <ListIcon size={14} className="text-muted" />}
              {folder && <span className="text-muted">{folder.name} /</span>}
              <span className="font-medium">{l.name}</span>
              <span className="text-faint text-xs">{n}</span>
            </Link>
          )
        })}
        <button
          onClick={() => {
            const n = window.prompt('New List name')
            if (n?.trim()) nav(`/app/list/${s.addList(spaceId, null, n.trim())}`)
          }}
          className="text-muted border-app hover-surface flex shrink-0 items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-sm"
        >
          <Plus size={14} /> New List
        </button>
        <button onClick={() => setTpl(true)} className="text-muted border-app hover-surface flex shrink-0 items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-sm">
          <LayoutTemplate size={14} /> From template
        </button>
        {tpl && <TemplatePicker spaceId={spaceId} open onClose={() => setTpl(false)} />}
      </div>
      <div className="min-h-0 flex-1">
        {lists.length ? (
          <ViewHost viewKey={`space-${spaceId}`} sourceTasks={tasks} statuses={space.statuses} defaultListId={lists[0].id} />
        ) : (
          <div className="text-muted p-10 text-center text-sm">This space has no Lists yet.</div>
        )}
      </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight, Folder as FolderIcon, LayoutTemplate, Layers, List as ListIcon, Lock, Map as MapIcon, MoreHorizontal, Plus, Star } from 'lucide-react'
import { TemplatePicker } from './components/Dialogs'
import { useStore } from '../store/useStore'
import type { ID } from '../store/types'
import { cn } from '../lib/utils'
import { MenuItem, Popover, usePopover } from './components/ui'

function SpaceBadge({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: color, width: size, height: size }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

export const rowCls = ({ isActive }: { isActive: boolean }) =>
  cn('group flex h-8 items-center gap-2 rounded-md px-2 text-[13px]', isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100 font-medium' : 'hover-surface text-app')

function ItemMenu({ onRename, onDelete, extra }: { onRename: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  const p = usePopover()
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          p.toggle(e)
        }}
        className="text-muted ml-auto hidden rounded p-0.5 group-hover:inline-flex hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="More actions"
      >
        <MoreHorizontal size={14} />
      </button>
      <Popover open={p.open} anchor={p.anchor} onClose={p.close} width={180}>
        {extra && <div onClick={p.close}>{extra}</div>}
        <MenuItem onClick={() => (p.close(), onRename())}>Rename</MenuItem>
        <MenuItem danger onClick={() => (p.close(), onDelete())}>
          Delete
        </MenuItem>
      </Popover>
    </>
  )
}

/** The Projects section: favorites and the project → folder → list tree. */
export function ProjectsSidebar() {
  const s = useStore()
  const nav = useNavigate()
  const [closed, setClosed] = useState<Record<ID, boolean>>({})
  const [templateSpace, setTemplateSpace] = useState<ID | null>(null)
  const toggle = (id: ID) => setClosed((c) => ({ ...c, [id]: !c[id] }))

  const prompt = (label: string, initial = '') => {
    const v = window.prompt(label, initial)
    return v && v.trim() ? v.trim() : null
  }

  const favItems = s.favorites
    .map((id) => {
      const l = s.lists.find((x) => x.id === id)
      if (l) return { id, name: l.name, to: `/app/list/${id}`, icon: <ListIcon size={14} /> }
      const d = s.docs.find((x) => x.id === id)
      if (d) return { id, name: d.title || 'Untitled', to: `/app/docs/${id}`, icon: <span className="text-xs">{d.emoji}</span> }
      return null
    })
    .filter(Boolean) as { id: ID; name: string; to: string; icon: React.ReactNode }[]

  return (
    <>
      {favItems.length > 0 && (
        <section className="mt-2">
          <div className="text-faint px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">Favorites</div>
          {favItems.map((f) => (
            <NavLink key={f.id} to={f.to} className={rowCls}>
              <span className="text-muted">{f.icon}</span>
              <span className="truncate">{f.name}</span>
              <Star size={12} className="ml-auto fill-amber-400 text-amber-400" />
            </NavLink>
          ))}
        </section>
      )}

      <section className="mt-3">
        <div className="flex items-center px-2 py-1">
          <span className="text-faint text-[11px] font-semibold uppercase tracking-wide">Spaces</span>
          <button
            className="text-muted hover-surface ml-auto rounded p-0.5"
            aria-label="New space"
            onClick={() => {
              const name = prompt('Name your new space')
              if (name) nav(`/app/space/${s.addSpace(name)}`)
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        <NavLink to="/app/everything" className={rowCls}>
          <Layers size={15} className="text-muted" /> Everything
        </NavLink>
        <NavLink to="/app/roadmap" className={rowCls}>
          <MapIcon size={15} className="text-muted" /> Roadmap
        </NavLink>

        {s.spaces.map((sp) => {
          const folders = s.folders.filter((f) => f.spaceId === sp.id)
          const looseLists = s.lists.filter((l) => l.spaceId === sp.id && !l.folderId)
          return (
            <div key={sp.id}>
              <NavLink to={`/app/space/${sp.id}`} className={rowCls}>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    toggle(sp.id)
                  }}
                  className="text-faint -mr-1"
                  aria-label={closed[sp.id] ? 'Expand' : 'Collapse'}
                >
                  <ChevronRight size={13} className={cn('transition-transform', !closed[sp.id] && 'rotate-90')} />
                </button>
                <SpaceBadge name={sp.name} color={sp.color} />
                <span className="truncate">{sp.name}</span>
                {sp.private && <Lock size={11} className="text-faint shrink-0" aria-label="Private" />}
                <ItemMenu
                  onRename={() => {
                    const n = prompt('Rename space', sp.name)
                    if (n) s.updateSpace(sp.id, { name: n })
                  }}
                  onDelete={() => confirm(`Delete “${sp.name}” and everything in it?`) && (s.deleteSpace(sp.id), nav('/app/everything'))}
                  extra={
                    <>
                      <MenuItem
                        onClick={() => {
                          const n = prompt('New List name')
                          if (n) nav(`/app/list/${s.addList(sp.id, null, n)}`)
                        }}
                      >
                        <ListIcon size={14} /> New List
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          const n = prompt('New Folder name')
                          if (n) s.addFolder(sp.id, n)
                        }}
                      >
                        <FolderIcon size={14} /> New Folder
                      </MenuItem>
                      <MenuItem onClick={() => setTemplateSpace(sp.id)}>
                        <LayoutTemplate size={14} /> List from template
                      </MenuItem>
                    </>
                  }
                />
              </NavLink>
              {!closed[sp.id] && (
                <div className="ml-4 border-l border-[var(--border)] pl-1.5">
                  {folders.map((f) => (
                    <div key={f.id}>
                      <div className="group hover-surface flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px]" onClick={() => toggle(f.id)}>
                        <FolderIcon size={14} className="text-muted" />
                        <span className="truncate">{f.name}</span>
                        <ItemMenu
                          onRename={() => {
                            const n = prompt('Rename Folder', f.name)
                            if (n) s.renameFolder(f.id, n)
                          }}
                          onDelete={() => confirm(`Delete folder “${f.name}”?`) && s.deleteFolder(f.id)}
                          extra={
                            <MenuItem
                              onClick={() => {
                                const n = prompt('New List name')
                                if (n) nav(`/app/list/${s.addList(sp.id, f.id, n)}`)
                              }}
                            >
                              <ListIcon size={14} /> New List
                            </MenuItem>
                          }
                        />
                      </div>
                      {!closed[f.id] &&
                        s.lists
                          .filter((l) => l.folderId === f.id)
                          .map((l) => <ListRow key={l.id} id={l.id} indent />)}
                    </div>
                  ))}
                  {looseLists.map((l) => (
                    <ListRow key={l.id} id={l.id} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button
          onClick={() => {
            const name = prompt('Name your new space')
            if (name) nav(`/app/space/${s.addSpace(name)}`)
          }}
          className="text-muted hover-surface flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px]"
        >
          <Plus size={14} /> New space
        </button>
      </section>

      {templateSpace && <TemplatePicker spaceId={templateSpace} open onClose={() => setTemplateSpace(null)} />}
    </>
  )
}

function ListRow({ id, indent }: { id: ID; indent?: boolean }) {
  const s = useStore()
  const nav = useNavigate()
  const list = s.lists.find((l) => l.id === id)!
  const count = s.tasks.filter((t) => t.listId === id && !t.parentId).length
  return (
    <NavLink to={`/app/list/${id}`} className={(a) => cn(rowCls(a), indent && 'ml-3')}>
      <ListIcon size={14} className="text-muted" />
      <span className="truncate">{list.name}</span>
      <span className="text-faint ml-auto text-[11px] group-hover:hidden">{count}</span>
      <ItemMenu
        onRename={() => {
          const n = window.prompt('Rename List', list.name)
          if (n?.trim()) s.renameList(id, n.trim())
        }}
        onDelete={() => confirm(`Delete list “${list.name}” and its tasks?`) && (s.deleteList(id), nav('/app/everything'))}
        extra={
          <MenuItem onClick={() => s.toggleFavorite(id)}>
            <Star size={14} /> {s.favorites.includes(id) ? 'Remove from favorites' : 'Add to favorites'}
          </MenuItem>
        }
      />
    </NavLink>
  )
}

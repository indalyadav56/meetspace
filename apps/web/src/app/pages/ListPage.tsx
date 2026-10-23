import { useEffect } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useStore } from '../../store/useStore'
import ViewHost from '../views/ViewHost'
import { InlineEdit } from '../components/ui'
import { cn } from '../../lib/utils'
import { ChevronRight } from 'lucide-react'

export default function ListPage() {
  const { listId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const s = useStore()
  const list = s.lists.find((l) => l.id === listId)
  const space = s.spaces.find((sp) => sp.id === list?.spaceId)
  const folder = s.folders.find((f) => f.id === list?.folderId)
  const tasks = s.tasks.filter((t) => t.listId === listId)
  const fav = s.favorites.includes(listId)

  useEffect(() => {
    if (list) s.touchRecent(listId)
    const t = params.get('task')
    if (t) {
      s.openTask(t)
      params.delete('task')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  if (!list || !space) return <Navigate to="/app/everything" replace />

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: space.color }}>
          {space.name[0]}
        </span>
        <span className="text-muted hidden text-sm sm:inline">{space.name}</span>
        {folder && (
          <>
            <ChevronRight size={14} className="text-faint hidden sm:block" />
            <span className="text-muted hidden text-sm sm:inline">{folder.name}</span>
          </>
        )}
        <ChevronRight size={14} className="text-faint hidden sm:block" />
        <InlineEdit value={list.name} onSave={(v) => s.renameList(listId, v)} className="min-w-0 text-base font-semibold" />
        <button onClick={() => s.toggleFavorite(listId)} aria-label="Toggle favorite" className="hover-surface rounded p-1">
          <Star size={15} className={cn(fav ? 'fill-amber-400 text-amber-400' : 'text-faint')} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ViewHost viewKey={listId} sourceTasks={tasks} statuses={space.statuses} defaultListId={listId} fieldListId={listId} />
      </div>
    </div>
  )
}

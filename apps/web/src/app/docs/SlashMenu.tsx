import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSlash } from './slash'
import { cn } from '../../lib/utils'

/** The "/" block menu, positioned at the caret. */
export function SlashMenu() {
  const { open, items, index, rect, choose } = useSlash()
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])
  if (!open || !rect) return null
  const below = rect.bottom + 300 < window.innerHeight
  const style = { left: Math.min(rect.left, window.innerWidth - 300), ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) }
  let lastGroup = ''
  return createPortal(
    <div ref={list} role="listbox" aria-label="Insert block" className="surface shadow-pop fixed z-[80] max-h-[300px] w-[280px] overflow-y-auto rounded-xl p-1.5 scroll-thin" style={style}>
      {items.length === 0 && <div className="text-muted px-2 py-3 text-sm">No matching blocks</div>}
      {items.map((c, i) => {
        const header = c.group !== lastGroup
        lastGroup = c.group
        return (
          <div key={c.key}>
            {header && <div className="text-faint px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">{c.group}</div>}
            <button
              data-i={i}
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => useSlash.setState({ index: i })}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left', i === index ? 'bg-brand-50 dark:bg-brand-500/15' : '')}
            >
              <span className="border-app surface flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                <c.icon size={15} className="text-muted" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.title}</span>
                <span className="text-muted block truncate text-xs">{c.hint}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

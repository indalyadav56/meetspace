import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleDot, Copy, ExternalLink, GitBranch, GitCommitHorizontal, GitMerge, GitPullRequest, GitPullRequestClosed, Github, Plus, X } from 'lucide-react'
import type { Task } from '../../store/types'
import { useStore } from '../../store/useStore'
import { integrations, type GitHubLink } from '../../api/integrations'
import { errorText } from '../pages/ai/agentsStore'
import { useIntegrations } from '../pages/apps/catalog'
import { Popover, usePopover } from '../components/ui'
import { cn } from '../../lib/utils'

/** A branch name that links itself: it contains the task key. */
export function branchName(task: Task) {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Keep it short, cutting at a word boundary.
  const short = slug.length > 40 ? slug.slice(0, 40).replace(/-[^-]*$/, '') : slug
  return `ms-${task.key}${short ? `-${short}` : ''}`
}

function LinkIcon({ l }: { l: GitHubLink }) {
  if (l.kind === 'commit') return <GitCommitHorizontal size={15} className="text-muted" />
  if (l.kind === 'issue') return <CircleDot size={15} className={l.state === 'open' ? 'text-emerald-600' : 'text-violet-500'} />
  if (l.state === 'merged') return <GitMerge size={15} className="text-violet-500" />
  if (l.state === 'closed') return <GitPullRequestClosed size={15} className="text-red-500" />
  return <GitPullRequest size={15} className="text-emerald-600" />
}

const stateLabel = (l: GitHubLink) => (l.kind === 'commit' ? l.ref : l.state)

export function GitHubSection({ task }: { task: Task }) {
  const ws = useStore((s) => s.currentWorkspaceId)
  const { status, workspaceId, load } = useIntegrations()
  const [links, setLinks] = useState<GitHubLink[] | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pop = usePopover()
  const connected = !!status?.github.connected

  useEffect(() => {
    if (ws && workspaceId !== ws) void load(ws).catch(() => {})
  }, [ws, workspaceId, load])
  useEffect(() => {
    let live = true
    setLinks(null)
    integrations.links(task.id).then((l) => live && setLinks(l), () => live && setLinks([]))
    return () => {
      live = false
    }
  }, [task.id])

  const branch = branchName(task)
  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const l = await integrations.link(task.id, url)
      setLinks((xs) => [l, ...(xs ?? []).filter((x) => x.id !== l.id)])
      setUrl('')
      pop.close()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (!connected && !links?.length)
    return (
      <section className="mt-8">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Github size={16} /> GitHub
        </h3>
        <p className="text-muted mt-2 text-sm">
          Link pull requests and commits to this task.{' '}
          <Link to="/app/apps?app=github" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">
            Connect GitHub
          </Link>
        </p>
      </section>
    )

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Github size={16} /> GitHub
        </h3>
        {connected && (
          <>
            <button onClick={pop.toggle} className="text-muted hover-surface ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
              <Plus size={13} /> Link
            </button>
            <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={340} align="end">
              <form
                className="p-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  void add()
                }}
              >
                <label className="text-muted text-xs font-medium">Pull request or issue URL</label>
                <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo/pull/42" className="border-app surface-subtle mt-1 w-full rounded-md border px-2 py-1.5 text-sm outline-none" />
                {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
                <button disabled={!url.trim() || busy} className="bg-brand-600 mt-2 w-full rounded-md py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? 'Linking…' : 'Link to task'}
                </button>
              </form>
            </Popover>
          </>
        )}
      </div>

      <div className="border-app surface-subtle mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
        <GitBranch size={14} className="text-muted shrink-0" />
        <span className="text-muted shrink-0">Branch</span>
        <code className="min-w-0 flex-1 truncate font-mono">{branch}</code>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(`git checkout -b ${branch}`)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="text-muted hover:text-app inline-flex items-center gap-1"
          title="Copy git checkout command"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-faint mb-2 text-[11px]">Mention MS-{task.key} in a pull request, branch or commit and it links here automatically.</p>

      {links === null ? (
        <p className="text-muted px-1 text-xs">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-muted px-1 text-xs">Nothing linked yet.</p>
      ) : (
        <div className="border-app overflow-hidden rounded-lg border">
          {links.map((l) => (
            <div key={l.id} className="group hover-surface flex items-center gap-2 px-3 py-2 text-sm">
              <LinkIcon l={l} />
              <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                <span className="text-muted mr-1.5 text-xs">{l.kind === 'commit' ? l.repo : `${l.repo}#${l.number}`}</span>
                {l.title}
              </a>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', l.kind === 'commit' ? 'font-mono' : 'capitalize', l.state === 'merged' ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : l.state === 'open' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'surface-muted text-muted')}>
                {stateLabel(l)}
              </span>
              <a href={l.url} target="_blank" rel="noreferrer" className="text-faint" aria-label="Open on GitHub">
                <ExternalLink size={13} />
              </a>
              <button
                onClick={() => integrations.unlink(l.id).then(() => setLinks((xs) => (xs ?? []).filter((x) => x.id !== l.id)), (e) => setError(errorText(e)))}
                className="text-faint hidden group-hover:block"
                aria-label="Unlink"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

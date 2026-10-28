import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, BookOpenCheck, Cable, MessageSquarePlus, Sparkles, Wand2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { useAssistant } from '../../ai/useAssistant'
import { useAgents } from './agentsStore'
import { Group, Row, SidebarShell } from '../../SectionSidebar'

export function AISidebar() {
  const ws = useStore((s) => s.currentWorkspaceId)
  const { list, workspaceId, load } = useAgents()
  const agents = list.filter((a) => a.kind !== 'skill')
  const skills = list.filter((a) => a.kind === 'skill' && a.enabled !== false)
  const persona = useAssistant((s) => s.persona)
  const server = useAssistant((s) => s.agent)
  const nav = useNavigate()

  useEffect(() => {
    if (ws && workspaceId !== ws) void load(ws)
    if (!useAssistant.getState().agent) void useAssistant.getState().loadAgent()
  }, [ws, workspaceId, load])

  const newChat = () => {
    useAssistant.getState().choosePersona(null)
    nav('/app/ai')
  }

  return (
    <SidebarShell
      title="AI"
      action={
        <button type="button" onClick={newChat} className="text-muted hover-surface rounded p-1" aria-label="New conversation" title="New conversation">
          <MessageSquarePlus size={15} />
        </button>
      }
    >
      <Group>
        <Row to="/app/ai" icon={Sparkles} label="Ask" keys={['view']} />
        <Row to="/app/ai?view=workspace" icon={BookOpenCheck} label="Ask the workspace" keys={['view']} />
        <Row to="/app/ai?view=agents" icon={Bot} label="Agents" count={agents.length} keys={['view']} />
        <Row to="/app/ai?view=skills" icon={Wand2} label="Skills" count={skills.length} keys={['view']} />
        <Row to="/app/apps" icon={Cable} label="Connections" />
      </Group>
      {agents.length > 0 && (
        <Group label="Your agents">
          {agents.map((a) => (
            <Row
              key={a.id}
              iconNode={<span className="w-[15px] text-center text-xs">{a.icon}</span>}
              label={a.name + (persona?.id === a.id ? ' · active' : '')}
              onClick={() => {
                useAssistant.getState().choosePersona(a)
                nav('/app/ai')
              }}
            />
          ))}
        </Group>
      )}
      <div className="mt-auto px-2 pt-4">
        <div className="border-app rounded-lg border px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <span className={server?.enabled ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-stone-400'} />
            {server?.enabled ? 'Gemini connected' : 'Offline mode'}
          </div>
          <p className="text-muted mt-0.5">{server?.enabled ? server.model : 'Set a Gemini key on the server for free-form answers.'}</p>
        </div>
      </div>
    </SidebarShell>
  )
}

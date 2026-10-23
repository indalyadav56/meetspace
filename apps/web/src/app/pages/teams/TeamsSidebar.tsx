import { useNavigate } from 'react-router-dom'
import { Activity, Network, UserRound, Users } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { AddButton, Group, Row, SidebarShell } from '../../SectionSidebar'

export function TeamsSidebar() {
  const { teams, currentUserId, workspaces, currentWorkspaceId } = useStore()
  const nav = useNavigate()
  const mine = teams.filter((t) => currentUserId && t.members.includes(currentUserId))
  const people = workspaces.find((w) => w.id === currentWorkspaceId)?.members.length ?? 0
  const keys = ['tab', 'team']
  return (
    <SidebarShell title="Teams" action={<AddButton label="New team" onClick={() => nav('/app/teams?new=1')} />}>
      <Group>
        <Row to="/app/teams" icon={Users} label="All Teams" count={teams.length} keys={keys} />
        <Row to="/app/teams?tab=people" icon={UserRound} label="All People" count={people} keys={keys} />
        <Row to="/app/teams?tab=org" icon={Network} label="Org Chart" keys={keys} />
        <Row to="/app/teams?tab=analytics" icon={Activity} label="Analytics" keys={keys} />
      </Group>
      <Group label="My Teams">
        {mine.length ? (
          mine.map((t) => (
            <Row
              key={t.id}
              to={`/app/teams?team=${t.id}`}
              iconNode={<span className="flex h-[15px] w-[15px] items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: t.color }}>{t.name[0]}</span>}
              label={t.name}
              count={t.members.length}
              keys={keys}
            />
          ))
        ) : (
          <p className="border-app text-faint mx-1 mt-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs">Once you join or create a Team you will see it here.</p>
        )}
      </Group>
    </SidebarShell>
  )
}

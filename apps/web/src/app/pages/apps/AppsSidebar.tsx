import { useEffect } from 'react'
import { Code2, LayoutGrid, Link2, Mail, Sparkles, Unlink, Video } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import { Group, Row, SidebarShell } from '../../SectionSidebar'
import { APPS, useIntegrations } from './catalog'

export function AppsSidebar() {
  const ws = useStore((s) => s.currentWorkspaceId)
  const { status, workspaceId, load } = useIntegrations()
  useEffect(() => {
    if (ws && workspaceId !== ws) void load(ws).catch(() => {})
  }, [ws, workspaceId, load])
  const connected = APPS.filter((a) => status?.[a.key]?.connected).length
  return (
    <SidebarShell title="App Center">
      <Group>
        <Row to="/app/apps" icon={LayoutGrid} label="All apps" count={APPS.length} keys={['category', 'app']} />
        <Row to="/app/apps?category=connected" icon={Link2} label="Connected" count={connected} keys={['category', 'app']} />
        <Row to="/app/apps?category=available" icon={Unlink} label="Not connected" count={APPS.length - connected} keys={['category', 'app']} />
      </Group>
      <Group label="Categories">
        <Row to="/app/apps?category=development" icon={Code2} label="Development" keys={['category', 'app']} />
        <Row to="/app/apps?category=communication" icon={Mail} label="Communication" keys={['category', 'app']} />
        <Row to="/app/apps?category=meetings" icon={Video} label="Meetings" keys={['category', 'app']} />
        <Row to="/app/apps?category=ai" icon={Sparkles} label="AI" keys={['category', 'app']} />
      </Group>
    </SidebarShell>
  )
}

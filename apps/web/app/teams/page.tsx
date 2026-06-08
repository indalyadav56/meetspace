import { PageHeader } from "@/components/page-header"
import { TeamsOverview } from "@/components/teams/teams-overview"

export default function TeamsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Teams</h1>
      </PageHeader>
      <TeamsOverview />
    </div>
  )
}

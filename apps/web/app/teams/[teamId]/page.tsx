import { TeamDetail } from "@/components/teams/team-detail"

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  return <TeamDetail teamId={teamId} />
}

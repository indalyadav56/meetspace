import { TeamBoardView } from "@/components/tasks/team-board-view"

export default async function TeamBoardPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  return <TeamBoardView teamId={teamId} />
}

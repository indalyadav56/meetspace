import { ChannelView } from "@/components/chat/channel-view"

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ teamId: string; channelId: string }>
}) {
  const { teamId, channelId } = await params
  return <ChannelView teamId={teamId} channelId={channelId} />
}

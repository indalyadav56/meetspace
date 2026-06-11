import { ChatView } from "@/components/chat/chat-view"

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  return <ChatView activeChatId={chatId} />
}

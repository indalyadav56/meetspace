"use client"

import * as React from "react"
import {
  AtSign,
  Bold,
  Italic,
  Link2,
  Paperclip,
  SendHorizontal,
  Smile,
  Sticker,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "😮", "👀", "✅", "🚀", "💡", "👏"]

export function MessageComposer({
  onSend,
  placeholder = "Type a message",
  autoFocus,
}: {
  onSend: (body: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [value, setValue] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const body = value.trim()
    if (!body) return
    onSend(body)
    setValue("")
    ref.current?.focus()
  }

  const insertEmoji = (emoji: string) => {
    setValue((v) => v + emoji)
    ref.current?.focus()
  }

  return (
    <div className="px-4 pb-4">
      <div className="rounded-xl border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="flex items-center gap-0.5 border-b px-2 py-1 text-muted-foreground">
          <ToolbarButton icon={Bold} label="Bold" />
          <ToolbarButton icon={Italic} label="Italic" />
          <ToolbarButton icon={Link2} label="Link" />
          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
          <ToolbarButton icon={AtSign} label="Mention" />
        </div>

        <textarea
          ref={ref}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="block max-h-40 min-h-9 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground [field-sizing:content]"
        />

        <div className="flex items-center gap-0.5 px-2 py-1.5 text-muted-foreground">
          <ToolbarButton icon={Paperclip} label="Attach" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-md hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Emoji"
              >
                <Smile className="size-4.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1">
              <div className="grid grid-cols-6 gap-0.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    aria-label={`Insert ${emoji}`}
                    className="flex size-8 items-center justify-center rounded-md text-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <ToolbarButton icon={Sticker} label="Sticker" />

          <Button
            size="icon"
            className="ml-auto size-8"
            disabled={!value.trim()}
            onClick={submit}
            aria-label="Send"
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
}: {
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-md hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      <Icon className="size-4.5" />
    </button>
  )
}

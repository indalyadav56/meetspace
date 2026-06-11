"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Hash } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useWorkspace } from "@/lib/store"

export function CreateChannelDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels keep conversation organized by topic.
          </DialogDescription>
        </DialogHeader>
        {teamId && (
          <ChannelForm teamId={teamId} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ChannelForm({
  teamId,
  onClose,
}: {
  teamId: string
  onClose: () => void
}) {
  const router = useRouter()
  const { createChannel } = useWorkspace()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")

  const submit = () => {
    if (!name.trim()) return
    const channel = createChannel(teamId, name, description)
    toast.success(`Channel #${channel.name} created`)
    onClose()
    router.push(`/teams/${teamId}/${channel.id}`)
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="channel-name">Channel name</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Hash />
            </InputGroupAddon>
            <InputGroupInput
              id="channel-name"
              placeholder="e.g. marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="channel-desc">Description</FieldLabel>
          <Textarea
            id="channel-desc"
            placeholder="What's this channel about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim()}>
          Create channel
        </Button>
      </DialogFooter>
    </>
  )
}

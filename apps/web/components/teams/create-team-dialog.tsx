"use client"

import * as React from "react"
import { Check } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b",
  "#10b981", "#06b6d4", "#0ea5e9", "#d946ef", "#64748b",
]
const ICONS = ["💻", "🎨", "🧭", "📈", "🚀", "⚙️", "🛠️", "🔬", "📣", "💡"]

function slugFromName(name: string) {
  return name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase()
}

export function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { users, createTeam } = useWorkspace()
  const [name, setName] = React.useState("")
  const [key, setKey] = React.useState("")
  const [keyTouched, setKeyTouched] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [color, setColor] = React.useState(COLORS[0])
  const [icon, setIcon] = React.useState(ICONS[0])
  const [members, setMembers] = React.useState<string[]>([])

  React.useEffect(() => {
    if (!open) {
      // reset on close
      setName("")
      setKey("")
      setKeyTouched(false)
      setDescription("")
      setColor(COLORS[0])
      setIcon(ICONS[0])
      setMembers([])
    }
  }, [open])

  const effectiveKey = keyTouched ? key : slugFromName(name)

  const toggleMember = (id: string) =>
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )

  const submit = () => {
    if (!name.trim()) return
    const team = createTeam({
      name,
      key: effectiveKey || "TM",
      description,
      color,
      icon,
      memberIds: members,
    })
    toast.success(`Team “${team.name}” created`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Teams group people and the work they own.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <div className="flex items-end gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor="team-icon">Icon</FieldLabel>
              <div
                id="team-icon"
                className="flex size-10 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${color}22` }}
              >
                {icon}
              </div>
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="team-name">Team name</FieldLabel>
              <Input
                id="team-name"
                placeholder="e.g. Marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field className="w-24">
              <FieldLabel htmlFor="team-key">Key</FieldLabel>
              <Input
                id="team-key"
                placeholder="MKT"
                value={effectiveKey}
                maxLength={4}
                onChange={(e) => {
                  setKeyTouched(true)
                  setKey(e.target.value.toUpperCase())
                }}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Choose an emoji</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border text-base transition-colors hover:bg-accent",
                    icon === emoji ? "border-primary bg-accent" : "border-transparent",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>Color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="team-desc">Description</FieldLabel>
            <Textarea
              id="team-desc"
              placeholder="What does this team own?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>

          <Field>
            <FieldLabel>Members</FieldLabel>
            <FieldDescription>Add teammates to this team.</FieldDescription>
            <div className="grid grid-cols-2 gap-1.5">
              {users.map((user) => {
                const selected = members.includes(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleMember(user.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      selected ? "border-primary bg-accent" : "border-border",
                    )}
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.initials}
                    </span>
                    <span className="truncate">{user.name}</span>
                    {selected && <Check className="ml-auto size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

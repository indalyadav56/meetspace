"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  IssueTypeIcon,
  PriorityFlag,
  TagBadge,
} from "@/components/shared/meta-badges"
import { ISSUE_TYPES, PRIORITIES, STATUSES, TAG_COLORS } from "@/lib/config"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { IssueTypeId, PriorityId, StatusId } from "@/lib/types"

const ISSUE_TYPE_LIST = Object.values(ISSUE_TYPES)

const COMMON_TAGS = Object.keys(TAG_COLORS)

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultStatus = "backlog",
  defaultTeamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStatus?: StatusId
  defaultTeamId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            Capture the work. You can refine the details any time.
          </DialogDescription>
        </DialogHeader>
        {/* Remounts on each open, so state always starts from the defaults. */}
        <TaskForm
          defaultStatus={defaultStatus}
          defaultTeamId={defaultTeamId}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  defaultStatus,
  defaultTeamId,
  onClose,
}: {
  defaultStatus: StatusId
  defaultTeamId?: string
  onClose: () => void
}) {
  const { teams, getUser, createTask } = useWorkspace()

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [type, setType] = React.useState<IssueTypeId>("task")
  const [status, setStatus] = React.useState<StatusId>(defaultStatus)
  const [priority, setPriority] = React.useState<PriorityId>("none")
  const [teamId, setTeamId] = React.useState(defaultTeamId ?? teams[0]?.id ?? "")
  const [assignees, setAssignees] = React.useState<string[]>([])
  const [dueDate, setDueDate] = React.useState("")
  const [tags, setTags] = React.useState<string[]>([])
  const [tagInput, setTagInput] = React.useState("")

  const team = teams.find((t) => t.id === teamId)
  const memberIds = team?.memberIds ?? []

  const toggleAssignee = (id: string) =>
    setAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag])
    setTagInput("")
  }

  const submit = () => {
    if (!title.trim() || !teamId) return
    createTask({
      title,
      description,
      type,
      status,
      priority,
      teamId,
      assigneeIds: assignees,
      dueDate: dueDate || null,
      tags,
    })
    toast.success("Issue created")
    onClose()
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="task-title" className="sr-only">
            Title
          </FieldLabel>
          <Input
            id="task-title"
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="font-medium md:text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="task-desc" className="sr-only">
            Description
          </FieldLabel>
          <Textarea
            id="task-desc"
            placeholder="Add a description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={type} onValueChange={(v) => setType(v as IssueTypeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ISSUE_TYPE_LIST.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <IssueTypeIcon type={t.id} />
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className={cn("size-2 rounded-full", s.dot)} />
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Priority</FieldLabel>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as PriorityId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <PriorityFlag priority={p.id} />
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Team</FieldLabel>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span>{t.icon}</span>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="task-due">Due date</FieldLabel>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Assignees</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                {assignees.length === 0 ? (
                  <span className="text-muted-foreground">Assign teammates…</span>
                ) : (
                  <span>
                    {assignees
                      .map((id) => getUser(id)?.name.split(" ")[0])
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1">
              {memberIds.map((id) => {
                const user = getUser(id)
                if (!user) return null
                const selected = assignees.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleAssignee(id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span
                      className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.initials}
                    </span>
                    <span className="truncate">{user.name}</span>
                    {selected && <Check className="ml-auto size-4 text-primary" />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel htmlFor="task-tags">Tags</FieldLabel>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1">
                  <TagBadge tag={tag} />
                  <button
                    type="button"
                    onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            id="task-tags"
            placeholder="Type a tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTag(tagInput)
              }
            }}
          />
          <div className="flex flex-wrap gap-1">
            {COMMON_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-dashed px-2 py-0.5 text-[11px] capitalize text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {tag}
              </button>
            ))}
          </div>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!title.trim() || !teamId}>
          Create issue
        </Button>
      </DialogFooter>
    </>
  )
}

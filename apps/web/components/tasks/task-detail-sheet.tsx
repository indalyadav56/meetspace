"use client"

import * as React from "react"
import {
  CalendarClock,
  Check,
  Flag,
  Hash,
  Plus,
  Shapes,
  Tag,
  Trash2,
  Users2,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { UserAvatar } from "@/components/shared/user-avatar"
import {
  IssueTypeIcon,
  PriorityFlag,
  StatusPill,
  TagBadge,
  TaskTypeIcon,
} from "@/components/shared/meta-badges"
import {
  ISSUE_TYPES,
  PRIORITIES,
  STATUSES,
  TAG_COLORS,
  getIssueType,
} from "@/lib/config"
import { timeAgo } from "@/lib/date"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/store"
import type { IssueTypeId, PriorityId, StatusId } from "@/lib/types"

const ISSUE_TYPE_LIST = Object.values(ISSUE_TYPES)

function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function TaskDetailSheet({
  taskId,
  onOpenChange,
}: {
  taskId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const {
    tasks,
    users,
    getUser,
    getTeam,
    updateTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    addComment,
  } = useWorkspace()

  const task = tasks.find((t) => t.id === taskId) ?? null
  const [subtaskInput, setSubtaskInput] = React.useState("")
  const [comment, setComment] = React.useState("")
  const [tagInput, setTagInput] = React.useState("")

  if (!task) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    )
  }

  const team = getTeam(task.teamId)
  const memberIds = team?.memberIds ?? users.map((u) => u.id)
  const assignees = task.assigneeIds
    .map((id) => getUser(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
  const doneCount = task.subtasks.filter((s) => s.done).length
  const progress = task.subtasks.length
    ? Math.round((doneCount / task.subtasks.length) * 100)
    : 0

  const toggleAssignee = (id: string) =>
    updateTask(task.id, {
      assigneeIds: task.assigneeIds.includes(id)
        ? task.assigneeIds.filter((a) => a !== id)
        : [...task.assigneeIds, id],
    })

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (tag && !task.tags.includes(tag)) {
      updateTask(task.id, { tags: [...task.tags, tag] })
    }
    setTagInput("")
  }

  const suggestedTags = Object.keys(TAG_COLORS).filter(
    (t) => !task.tags.includes(t),
  )

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="flex-row items-center gap-2 border-b px-5 py-3">
          <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <TaskTypeIcon task={task} />
            {task.key}
          </span>
          {team && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${team.color}1a`, color: team.color }}
            >
              {team.icon} {team.name}
            </span>
          )}
          <SheetTitle className="sr-only">{task.title}</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-muted-foreground hover:text-destructive"
            aria-label="Delete issue"
            onClick={() => {
              deleteTask(task.id)
              onOpenChange(false)
            }}
          >
            <Trash2 />
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 px-5 py-5">
            <div className="flex flex-col gap-3">
              <Textarea
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                rows={1}
                className="resize-none border-0 px-0 text-lg! font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
                placeholder="Issue title"
              />
              <Textarea
                value={task.description}
                onChange={(e) =>
                  updateTask(task.id, { description: e.target.value })
                }
                placeholder="Add a description…"
                className="min-h-20 resize-none border-0 px-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>

            <Separator />

            {/* Properties */}
            <div className="flex flex-col gap-3">
              <PropertyRow icon={Shapes} label="Type">
                <Select
                  value={getIssueType(task).id}
                  onValueChange={(v) => updateTask(task.id, { type: v as IssueTypeId })}
                >
                  <SelectTrigger className="h-8 w-fit gap-2 border-0 bg-transparent px-1 shadow-none hover:bg-accent dark:bg-transparent dark:hover:bg-accent">
                    <span className="flex items-center gap-1.5 text-sm">
                      <TaskTypeIcon task={task} />
                      {getIssueType(task).label}
                    </span>
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
              </PropertyRow>

              <PropertyRow icon={Hash} label="Status">
                <Select
                  value={task.status}
                  onValueChange={(v) => updateTask(task.id, { status: v as StatusId })}
                >
                  <SelectTrigger className="h-8 w-fit gap-2 border-0 bg-transparent px-1 shadow-none hover:bg-accent dark:bg-transparent dark:hover:bg-accent">
                    <StatusPill status={task.status} />
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
              </PropertyRow>

              <PropertyRow icon={Flag} label="Priority">
                <Select
                  value={task.priority}
                  onValueChange={(v) =>
                    updateTask(task.id, { priority: v as PriorityId })
                  }
                >
                  <SelectTrigger className="h-8 w-fit gap-2 border-0 bg-transparent px-1 shadow-none hover:bg-accent dark:bg-transparent dark:hover:bg-accent">
                    <PriorityFlag priority={task.priority} withLabel />
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
              </PropertyRow>

              <PropertyRow icon={Users2} label="Assignees">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex min-h-8 items-center gap-1.5 rounded-md px-1 py-1 hover:bg-accent">
                      {assignees.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          Unassigned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="flex items-center">
                            {assignees.map((u, i) => (
                              <UserAvatar
                                key={u.id}
                                user={u}
                                className={cn("ring-2 ring-background", i > 0 && "-ml-2")}
                              />
                            ))}
                          </span>
                          <span className="text-sm">
                            {assignees.map((u) => u.name.split(" ")[0]).join(", ")}
                          </span>
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-1">
                    {memberIds.map((id) => {
                      const user = getUser(id)
                      if (!user) return null
                      const selected = task.assigneeIds.includes(id)
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleAssignee(id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <UserAvatar user={user} />
                          <span className="truncate">{user.name}</span>
                          {selected && (
                            <Check className="ml-auto size-4 text-primary" />
                          )}
                        </button>
                      )
                    })}
                  </PopoverContent>
                </Popover>
              </PropertyRow>

              <PropertyRow icon={CalendarClock} label="Due date">
                <Input
                  type="date"
                  value={task.dueDate ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, { dueDate: e.target.value || null })
                  }
                  className="h-8 w-fit border-0 bg-transparent px-1 shadow-none hover:bg-accent dark:bg-transparent"
                />
              </PropertyRow>

              <PropertyRow icon={Tag} label="Tags">
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        updateTask(task.id, {
                          tags: task.tags.filter((t) => t !== tag),
                        })
                      }
                      className="group/tag"
                      title="Remove tag"
                    >
                      <TagBadge tag={tag} />
                    </button>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex size-5 items-center justify-center rounded-full border border-dashed text-muted-foreground hover:bg-accent hover:text-foreground">
                        <Plus className="size-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-2">
                      <Input
                        placeholder="New tag…"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addTag(tagInput)
                          }
                        }}
                        className="mb-2 h-8"
                      />
                      <div className="flex flex-wrap gap-1">
                        {suggestedTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            className="rounded-full border border-dashed px-2 py-0.5 text-[11px] capitalize text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </PropertyRow>
            </div>

            <Separator />

            {/* Subtasks */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Subtasks</h4>
                {task.subtasks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{task.subtasks.length}
                  </span>
                )}
              </div>
              {task.subtasks.length > 0 && (
                <Progress value={progress} className="h-1.5" />
              )}
              <div className="flex flex-col">
                {task.subtasks.map((sub) => (
                  <label
                    key={sub.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={sub.done}
                      onCheckedChange={() => toggleSubtask(task.id, sub.id)}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        sub.done && "text-muted-foreground line-through",
                      )}
                    >
                      {sub.title}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-muted-foreground" />
                <Input
                  placeholder="Add a subtask…"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subtaskInput.trim()) {
                      addSubtask(task.id, subtaskInput)
                      setSubtaskInput("")
                    }
                  }}
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
            </div>

            <Separator />

            {/* Activity */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold">Activity</h4>
              <div className="flex flex-col gap-4">
                {task.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No comments yet. Start the conversation.
                  </p>
                )}
                {task.comments.map((c) => {
                  const author = getUser(c.authorId)
                  return (
                    <div key={c.id} className="flex gap-2.5">
                      {author && <UserAvatar user={author} className="mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {author?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90">{c.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Comment composer */}
        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            placeholder="Write a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={1}
            className="min-h-9 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && comment.trim()) {
                addComment(task.id, comment)
                setComment("")
              }
            }}
          />
          <Button
            size="sm"
            disabled={!comment.trim()}
            onClick={() => {
              addComment(task.id, comment)
              setComment("")
            }}
          >
            Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

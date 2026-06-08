"use client"

import * as React from "react"
import type { PriorityId, StatusId, Task, Team, User } from "./types"
import { CURRENT_USER_ID, TASKS, TEAMS, USERS } from "./mock-data"

export interface NewTaskInput {
  title: string
  description?: string
  status?: StatusId
  priority?: PriorityId
  teamId: string
  assigneeIds?: string[]
  tags?: string[]
  dueDate?: string | null
}

export interface NewTeamInput {
  name: string
  key: string
  description?: string
  color: string
  icon: string
  memberIds?: string[]
  leadId?: string
}

interface WorkspaceContextValue {
  users: User[]
  teams: Team[]
  tasks: Task[]
  currentUser: User
  getUser: (id: string) => User | undefined
  getTeam: (id: string) => Team | undefined
  createTask: (input: NewTaskInput) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, status: StatusId) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  addSubtask: (taskId: string, title: string) => void
  addComment: (taskId: string, body: string) => void
  createTeam: (input: NewTeamInput) => Team
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = React.useState<Team[]>(TEAMS)
  const [tasks, setTasks] = React.useState<Task[]>(TASKS)

  const currentUser = React.useMemo(
    () => USERS.find((u) => u.id === CURRENT_USER_ID) ?? USERS[0],
    [],
  )

  const getUser = React.useCallback((id: string) => USERS.find((u) => u.id === id), [])
  const getTeam = React.useCallback(
    (id: string) => teams.find((t) => t.id === id),
    [teams],
  )

  const createTask = React.useCallback(
    (input: NewTaskInput) => {
      const team = teams.find((t) => t.id === input.teamId)
      const count = tasks.filter((t) => t.teamId === input.teamId).length
      const now = today()
      const task: Task = {
        id: uid("task"),
        key: `${team?.key ?? "TSK"}-${100 + count + 1}`,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        status: input.status ?? "backlog",
        priority: input.priority ?? "none",
        assigneeIds: input.assigneeIds ?? [],
        teamId: input.teamId,
        tags: input.tags ?? [],
        dueDate: input.dueDate ?? null,
        subtasks: [],
        comments: [],
        createdAt: now,
        updatedAt: now,
      }
      setTasks((prev) => [task, ...prev])
      return task
    },
    [teams, tasks],
  )

  const updateTask = React.useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: today() } : t)),
    )
  }, [])

  const deleteTask = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const moveTask = React.useCallback((id: string, status: StatusId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, updatedAt: today() } : t)),
    )
  }, [])

  const toggleSubtask = React.useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, done: !s.done } : s,
              ),
            }
          : t,
      ),
    )
  }, [])

  const addSubtask = React.useCallback((taskId: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: uid("sub"), title: title.trim(), done: false }] }
          : t,
      ),
    )
  }, [])

  const addComment = React.useCallback((taskId: string, body: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [
                ...t.comments,
                {
                  id: uid("cmt"),
                  authorId: CURRENT_USER_ID,
                  body: body.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : t,
      ),
    )
  }, [])

  const createTeam = React.useCallback((input: NewTeamInput) => {
    const team: Team = {
      id: uid("team"),
      name: input.name.trim(),
      key: input.key.trim().toUpperCase(),
      description: input.description?.trim() ?? "",
      color: input.color,
      icon: input.icon,
      memberIds: input.memberIds ?? [CURRENT_USER_ID],
      leadId: input.leadId ?? CURRENT_USER_ID,
      createdAt: today(),
    }
    setTeams((prev) => [...prev, team])
    return team
  }, [])

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      users: USERS,
      teams,
      tasks,
      currentUser,
      getUser,
      getTeam,
      createTask,
      updateTask,
      deleteTask,
      moveTask,
      toggleSubtask,
      addSubtask,
      addComment,
      createTeam,
    }),
    [teams, tasks, currentUser, getUser, getTeam, createTask, updateTask, deleteTask, moveTask, toggleSubtask, addSubtask, addComment, createTeam],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider")
  return ctx
}

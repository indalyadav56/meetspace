"use client"

import * as React from "react"
import { Calendar, Clock, AlertCircle } from "lucide-react"

import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { PriorityFlag, TaskTypeIcon } from "@/components/shared/meta-badges"
import { PRIORITIES, STATUSES } from "@/lib/config"
import { useWorkspace } from "@/lib/store"
import type { Task } from "@/lib/types"

export function TaskTimeline({
  tasks,
  onOpenTask,
}: {
  tasks: Task[]
  onOpenTask: (task: Task) => void
}) {
  const { getUser } = useWorkspace()

  // Generate 14 days grid starting from today
  const days = React.useMemo(() => {
    const arr = []
    const base = new Date()
    for (let i = -2; i < 12; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      arr.push({
        dateStr: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-US", { weekday: "narrow", day: "numeric" }),
        isToday: d.toDateString() === base.toDateString()
      })
    }
    return arr
  }, [])

  // Process schedule for each task
  const scheduledTasks = React.useMemo(() => {
    return tasks.map(t => {
      const startStr = t.createdAt.slice(0, 10)
      const endStr = t.dueDate || new Date(new Date(t.createdAt).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      // Find column indices
      const startIndex = days.findIndex(d => d.dateStr === startStr)
      const endIndex = days.findIndex(d => d.dateStr === endStr)

      const colStart = startIndex !== -1 ? startIndex + 1 : 1
      const colEnd = endIndex !== -1 ? endIndex + 2 : 5 // span at least some columns

      return {
        task: t,
        colStart: Math.min(colStart, colEnd),
        colSpan: Math.max(1, colEnd - colStart),
        unscheduled: !t.dueDate
      }
    })
  }, [tasks, days])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/40 border rounded-2xl">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="size-4.5 text-primary" />
          <span className="text-xs font-semibold">Workspace Timeline Schedule (Gantt)</span>
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="size-2 bg-primary rounded" /> Scheduled</span>
          <span className="flex items-center gap-1"><span className="size-2 bg-yellow-500 rounded" /> Unscheduled (Simulated End)</span>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-auto custom-scrollbar flex">
        
        {/* Sticky Task Names Sidebar */}
        <div className="w-64 border-r bg-card/65 sticky left-0 z-10 shrink-0 flex flex-col">
          {/* Header corner */}
          <div className="h-10 border-b bg-muted/40 px-4 flex items-center text-[10px] font-semibold text-muted-foreground">
            Tasks
          </div>
          {/* Task lists */}
          <div className="flex-1">
            {scheduledTasks.map(({ task }) => (
              <div 
                key={task.id}
                onClick={() => onOpenTask(task)}
                className="h-12 border-b px-4 flex items-center gap-2 cursor-pointer hover:bg-accent/40 group transition-colors"
              >
                <TaskTypeIcon task={task} />
                <span className="text-xs font-mono text-muted-foreground shrink-0">{task.key}</span>
                <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{task.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timetable Grid scrollable area */}
        <div className="flex-1 flex flex-col min-w-[700px]">
          
          {/* Calendar Day Columns Headers */}
          <div className="h-10 border-b bg-muted/20 grid grid-cols-14 shrink-0">
            {days.map((day, idx) => (
              <div 
                key={idx} 
                className={`border-r last:border-r-0 flex flex-col items-center justify-center text-[10px] text-center font-semibold leading-tight ${day.isToday ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}
              >
                {day.label}
              </div>
            ))}
          </div>

          {/* Gantt Row Bars */}
          <div className="flex-1 relative">
            
            {/* Grid vertical background lines */}
            <div className="absolute inset-0 grid grid-cols-14 pointer-events-none">
              {days.map((day, idx) => (
                <div key={idx} className={`border-r last:border-r-0 h-full ${day.isToday ? 'bg-primary/[0.02] border-r-primary/20' : 'border-r-muted/10'}`} />
              ))}
            </div>

            {/* Timetable Bars Content */}
            <div className="relative z-10">
              {scheduledTasks.map(({ task, colStart, colSpan, unscheduled }, idx) => {
                const assignees = task.assigneeIds.map(id => getUser(id)).filter(Boolean)
                const statusMeta = STATUSES.find(s => s.id === task.status)
                return (
                  <div 
                    key={task.id} 
                    className="h-12 border-b flex items-center relative"
                  >
                    {/* The Schedule Bar */}
                    <div 
                      onClick={() => onOpenTask(task)}
                      style={{ 
                        gridColumnStart: colStart, 
                        gridColumnEnd: colStart + colSpan 
                      }}
                      className={`absolute h-7 rounded-lg flex items-center justify-between px-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md ${
                        unscheduled 
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400" 
                          : "bg-primary/10 border border-primary/30 text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className={`size-1.5 rounded-full ${statusMeta?.dot || 'bg-slate-400'}`} />
                        <span className="text-[10px] font-bold truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {assignees.length > 0 && (
                          <PresenceAvatar user={assignees[0] as any} className="size-4.5 rounded-md" showPresence={false} />
                        )}
                        <span className="text-[9px] font-semibold opacity-75">
                          {unscheduled ? "No due date" : task.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

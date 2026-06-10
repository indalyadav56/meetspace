"use client"

import * as React from "react"
import { 
  Activity, 
  Bell, 
  Calendar, 
  CheckCircle2, 
  ClipboardList, 
  Clock, 
  Compass, 
  MessageSquare, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Plus, 
  ScreenShare, 
  Settings, 
  SquareKanban, 
  Tv, 
  UserPlus, 
  Users, 
  Video, 
  VideoOff, 
  Volume2, 
  Zap 
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { TaskBoard } from "@/components/tasks/task-board"
import { ActivityFeed } from "@/components/activity/activity-feed"
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog"
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet"
import { useWorkspace } from "@/lib/store"
import { PRIORITIES, STATUSES } from "@/lib/config"
import type { StatusId, Task } from "@/lib/types"

export function CommandCenter() {
  const { 
    tasks, 
    users, 
    meetings, 
    activity, 
    currentUser, 
    getUser, 
    moveTask, 
    deleteTask 
  } = useWorkspace()

  // Tabs state
  const [activeTab, setActiveTab] = React.useState("overview")

  // Task dialog & details state
  const [createOpen, setCreateOpen] = React.useState(false)
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null)
  const [createDefaults, setCreateDefaults] = React.useState<{ status: StatusId; teamId?: string }>({
    status: "backlog"
  })

  // Huddle states
  const [isHuddleActive, setIsHuddleActive] = React.useState(false)
  const [huddleName, setHuddleName] = React.useState("Product Alignment & Sync")
  const [isMuted, setIsMuted] = React.useState(false)
  const [isVideoOff, setIsVideoOff] = React.useState(false)
  const [isScreenSharing, setIsScreenSharing] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [activeSpeakerId, setActiveSpeakerId] = React.useState<string>("")
  const [huddleChat, setHuddleChat] = React.useState<{ sender: string; text: string; time: string }[]>([
    { sender: "Charlie Chen", text: "Welcome everyone! Let's review the sprint board today.", time: "1:31 PM" },
    { sender: "Sarah Jenkins", text: "I have updated the design Figma link inside the task description.", time: "1:32 PM" }
  ])
  const [chatInput, setChatInput] = React.useState("")
  const [huddleTime, setHuddleTime] = React.useState(0)

  // Auto-switch speaker simulation
  React.useEffect(() => {
    if (!isHuddleActive) return
    const callMembers = users.filter(u => u.id !== currentUser.id).map(u => u.id)
    setActiveSpeakerId(currentUser.id)

    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * (callMembers.length + 1))
      setActiveSpeakerId(idx === callMembers.length ? currentUser.id : callMembers[idx])
    }, 4000)

    const timer = setInterval(() => {
      setHuddleTime(prev => prev + 1)
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(timer)
    }
  }, [isHuddleActive, users, currentUser.id])

  const formatHuddleTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0")
    const s = (secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const handleSendHuddleChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    setHuddleChat(prev => [
      ...prev,
      { sender: currentUser.name, text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ])
    setChatInput("")
  }

  // Filter tasks assigned to current user
  const myFocusTasks = React.useMemo(() => {
    return tasks.filter(t => t.assigneeIds.includes(currentUser.id) && t.status !== "done")
  }, [tasks, currentUser.id])

  // Count stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === "done").length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const startHuddle = (name: string) => {
    setHuddleName(name)
    setIsHuddleActive(true)
    toast.success(`Huddle "${name}" started!`)
  }

  const joinHuddle = (name: string) => {
    setHuddleName(name)
    setIsHuddleActive(true)
    toast.success(`Joined huddle: ${name}`)
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/30 p-6">
      
      {/* 🚀 SIMULATED HUDDLE OVERLAY MODAL */}
      {isHuddleActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <div className="glass-panel relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-slate-950/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex size-4 items-center justify-center">
                  <span className="absolute size-3 animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative size-2 rounded-full bg-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{huddleName}</h2>
                  <p className="text-xs text-slate-400">
                    Live Session &bull; {formatHuddleTime(huddleTime)} &bull; {isRecording ? "Recording" : "Ready"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant={isRecording ? "destructive" : "outline"} 
                  size="sm" 
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => {
                    setIsRecording(p => !p)
                    toast.success(isRecording ? "Recording saved" : "Recording started")
                  }}
                >
                  <CheckCircle2 className="size-3.5" />
                  {isRecording ? "Stop Recording" : "Record"}
                </Button>
                <div className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300">
                  HD Video Sync
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Video Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                
                {/* My Video */}
                <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl bg-slate-950 border transition-all duration-300 ${activeSpeakerId === currentUser.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-900' : 'border-slate-800'}`}>
                  {isVideoOff ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
                      <PresenceAvatar user={currentUser} className="size-16" />
                      <span className="text-sm font-medium text-white">{currentUser.name} (You)</span>
                      <span className="text-xs text-slate-500">Camera Off</span>
                    </div>
                  ) : (
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900/80 to-purple-950/80 p-6 min-h-[160px]">
                      {/* Simulated video background animation */}
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-transparent to-transparent animate-pulse" />
                      <PresenceAvatar user={currentUser} className="size-16 ring-4 ring-primary/30" />
                      
                      {activeSpeakerId === currentUser.id && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
                          <Volume2 className="size-3" />
                          <span>Speaking</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1 text-xs text-white">
                    <span className="font-semibold">{currentUser.name} (You)</span>
                    {isMuted ? <MicOff className="size-3.5 text-red-400" /> : <Mic className="size-3.5 text-emerald-400" />}
                  </div>
                </div>

                {/* Other Members Videos */}
                {users.filter(u => u.id !== currentUser.id).slice(0, 5).map((u) => {
                  const isUserSpeaking = activeSpeakerId === u.id
                  const userMuted = u.presence === "dnd" || u.presence === "offline"
                  return (
                    <div 
                      key={u.id} 
                      className={`relative flex flex-col justify-between overflow-hidden rounded-xl bg-slate-950 border transition-all duration-300 ${isUserSpeaking ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-900' : 'border-slate-800'}`}
                    >
                      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-tr from-slate-900 via-indigo-950/50 to-slate-900 p-6 min-h-[160px]">
                        <PresenceAvatar user={u} className="size-16 ring-4 ring-primary/10" />
                        
                        {isUserSpeaking && (
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
                            <Volume2 className="size-3" />
                            <span>Speaking</span>
                          </div>
                        )}
                        
                        {isUserSpeaking && !userMuted && (
                          <div className="absolute bottom-16 flex gap-0.5">
                            <span className="voice-wave-bar" />
                            <span className="voice-wave-bar" />
                            <span className="voice-wave-bar" />
                            <span className="voice-wave-bar" />
                            <span className="voice-wave-bar" />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1 text-xs text-white">
                        <span className="font-semibold">{u.name}</span>
                        {userMuted ? <MicOff className="size-3.5 text-red-400" /> : <Mic className="size-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  )
                })}

                {/* Screen Share simulation */}
                {isScreenSharing && (
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-slate-950 border border-primary ring-2 ring-primary ring-offset-2 ring-offset-slate-900 col-span-1 sm:col-span-2 min-h-[220px]">
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-indigo-950/20">
                      <Tv className="size-12 text-primary animate-pulse" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">You are sharing your screen</p>
                        <p className="text-xs text-slate-400 mt-1">Sharing Entire Screen &bull; Recording Active</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setIsScreenSharing(false)} className="mt-2">
                        Stop Sharing
                      </Button>
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-1 text-xs text-white">
                      <span>Live Screen Broadcast</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Sidebar */}
              <div className="w-80 border-l bg-slate-950/15 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-950/20">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    Huddle Conversation
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                  {huddleChat.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-slate-300">{msg.sender}</span>
                        <span className="text-[10px] text-slate-500">{msg.time}</span>
                      </div>
                      <p className="text-xs text-slate-400 rounded-lg bg-slate-900/60 p-2 border border-slate-800/40">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendHuddleChat} className="p-3 border-t bg-slate-950/20 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button type="submit" size="sm" className="h-8 text-xs">Send</Button>
                </form>
              </div>
            </div>

            {/* Footer / Call Controls */}
            <div className="flex items-center justify-between border-t bg-slate-950/50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant={isMuted ? "destructive" : "secondary"} 
                  size="icon" 
                  className="size-11 rounded-full"
                  onClick={() => setIsMuted(p => !p)}
                >
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </Button>
                <Button 
                  variant={isVideoOff ? "destructive" : "secondary"} 
                  size="icon" 
                  className="size-11 rounded-full"
                  onClick={() => setIsVideoOff(p => !p)}
                >
                  {isVideoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </Button>
                <Button 
                  variant={isScreenSharing ? "default" : "secondary"} 
                  size="icon" 
                  className={`size-11 rounded-full ${isScreenSharing ? 'bg-primary text-white' : ''}`}
                  onClick={() => {
                    setIsScreenSharing(p => !p)
                    toast.success(isScreenSharing ? "Screen sharing ended" : "Select window to share...")
                  }}
                >
                  <ScreenShare className="size-5" />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border">
                  <Users className="size-3.5 text-primary" />
                  <span>{users.length} connected</span>
                </div>
                <Button 
                  variant="destructive" 
                  className="rounded-full px-6 gap-2"
                  onClick={() => {
                    setIsHuddleActive(false)
                    toast.info("Left the huddle")
                  }}
                >
                  <PhoneOff className="size-4" />
                  Leave
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🏡 MASTER CONSOLE DASHBOARD */}
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        
        {/* Welcome Section */}
        <div className="glass-card glow-card rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
              Good afternoon, {currentUser.name}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome to the Meetspace Command Center. You have <strong className="text-foreground">{myFocusTasks.length} pending issues</strong> and <strong className="text-foreground">{activity.filter(a => !a.read).length} unread updates</strong>.
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button size="sm" variant="default" className="gap-1.5 shadow-sm" onClick={() => {
                setCreateDefaults({ status: "todo" })
                setCreateOpen(true)
              }}>
                <Plus className="size-4" />
                New Issue
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => startHuddle("Engineering Standup")}>
                <Video className="size-4" />
                Start Live Huddle
              </Button>
            </div>
          </div>

          {/* Dynamic Completion Widget */}
          <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border self-start md:self-auto min-w-[200px]">
            <div className="relative size-14 flex items-center justify-center">
              {/* SVG circular progress bar */}
              <svg className="size-full transform -rotate-90">
                <circle cx="28" cy="28" r="24" className="stroke-muted" strokeWidth="4" fill="transparent" />
                <circle 
                  cx="28" 
                  cy="28" 
                  r="24" 
                  className="stroke-primary transition-all duration-1000 ease-out" 
                  strokeWidth="4" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 * (1 - completionRate / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-semibold">{completionRate}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Issues Solved</span>
              <span className="text-lg font-bold">{completedTasks} / {totalTasks}</span>
              <span className="text-[10px] text-muted-foreground">in active workspace</span>
            </div>
          </div>
        </div>

        {/* Tab Console */}
        <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between border-b pb-1 mb-4">
            <TabsList className="bg-muted/40 p-1 rounded-xl border">
              <TabsTrigger value="overview" className="rounded-lg gap-1.5"><Compass className="size-4" />Command Center</TabsTrigger>
              <TabsTrigger value="board" className="rounded-lg gap-1.5"><SquareKanban className="size-4" />Jira Board</TabsTrigger>
              <TabsTrigger value="huddles" className="rounded-lg gap-1.5"><Video className="size-4" />Teams Huddles</TabsTrigger>
              <TabsTrigger value="inbox" className="rounded-lg gap-1.5"><Bell className="size-4" />Inbox</TabsTrigger>
            </TabsList>
            <div className="text-xs text-muted-foreground hidden sm:block">
              Double Click tasks to view details
            </div>
          </div>

          {/* 1. Overview Tab */}
          <TabsContent value="overview" className="flex flex-col gap-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left & Middle Column */}
              <div className="md:col-span-2 flex flex-col gap-6">
                
                {/* My Focus Issues */}
                <Card className="glass-card shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <ClipboardList className="size-5 text-primary" />
                      My Focus Console
                    </CardTitle>
                    <CardDescription>High-priority tasks currently assigned to you</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {myFocusTasks.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        No active issues. Good job!
                      </div>
                    ) : (
                      myFocusTasks.slice(0, 4).map((task) => {
                        const priorityMeta = PRIORITIES.find(p => p.id === task.priority)
                        const statusMeta = STATUSES.find(s => s.id === task.status)
                        return (
                          <div 
                            key={task.id} 
                            onClick={() => setOpenTaskId(task.id)}
                            className="flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:bg-card hover:border-primary/20 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`size-2.5 rounded-full ${statusMeta?.dot || 'bg-slate-400'}`} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-[10px] text-muted-foreground">{task.key}</span>
                                  {task.dueDate && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock className="size-3" />
                                      {task.dueDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {priorityMeta && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${priorityMeta.color} bg-muted`}>
                                  {priorityMeta.label}
                                </span>
                              )}
                              <Button 
                                size="xs" 
                                variant="ghost" 
                                className="h-7 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveTask(task.id, "done")
                                  toast.success("Task completed!")
                                }}
                              >
                                Mark Done
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {/* CSS Metrics Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Issue Type breakdown chart */}
                  <Card className="glass-card shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="size-4.5 text-primary" />
                        Issue Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      {/* Bar graph representing distribution */}
                      <div className="flex flex-col gap-2.5">
                        {[
                          { label: "Bugs", count: tasks.filter(t => t.tags.includes("bug") || t.type === "bug").length, color: "bg-red-500", w: "60%" },
                          { label: "Stories / Features", count: tasks.filter(t => t.tags.includes("feature") || t.type === "story").length, color: "bg-emerald-500", w: "80%" },
                          { label: "Tasks", count: tasks.filter(t => !t.type || t.type === "task").length, color: "bg-sky-500", w: "45%" },
                          { label: "Epics", count: tasks.filter(t => t.type === "epic").length, color: "bg-violet-500", w: "20%" },
                        ].map((item, idx) => {
                          const percentage = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0
                          return (
                            <div key={idx} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">{item.label}</span>
                                <span className="font-semibold">{item.count} ({percentage}%)</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Task Workload Distribution */}
                  <Card className="glass-card shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="size-4.5 text-primary" />
                        Team Workload
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {users.slice(0, 4).map((user) => {
                        const count = tasks.filter(t => t.assigneeIds.includes(user.id) && t.status !== "done").length
                        const percentage = totalTasks > 0 ? Math.round((count / tasks.filter(t => t.status !== "done").length) * 100) : 0
                        return (
                          <div key={user.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <PresenceAvatar user={user} className="size-7" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{user.name}</p>
                                <p className="text-[10px] text-muted-foreground">{user.role}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold">{count} tasks</span>
                              <p className="text-[10px] text-muted-foreground">{percentage}% load</p>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                </div>

              </div>

              {/* Right Sidebar Column */}
              <div className="flex flex-col gap-6">
                
                {/* MS Teams Live Meeting Widget */}
                <Card className="glass-card border-l-4 border-l-primary bg-primary/[0.02] shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Video className="size-5 text-primary animate-pulse" />
                      Active Huddles
                    </CardTitle>
                    <CardDescription>Teams rooms active right now</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {meetings.filter(m => m.online).map((meeting) => {
                      const attendees = meeting.attendeeIds.map(id => getUser(id)).filter(Boolean)
                      return (
                        <div key={meeting.id} className="p-3 bg-card/65 rounded-xl border border-muted flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold truncate pr-2">{meeting.title}</h4>
                            <span className="flex size-2 items-center justify-center relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2 overflow-hidden">
                              {attendees.slice(0, 3).map((u, i) => (
                                <PresenceAvatar key={i} user={u as any} className="size-6 ring-2 ring-background" showPresence={false} />
                              ))}
                              {attendees.length > 3 && (
                                <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
                                  +{attendees.length - 3}
                                </div>
                              )}
                            </div>
                            
                            <Button size="xs" onClick={() => joinHuddle(meeting.title)} className="h-7 text-[11px] rounded-lg">
                              Join Call
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    
                    <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 py-1.5 mt-1" onClick={() => startHuddle("Design Sync Workspace")}>
                      <Plus className="size-3.5" /> Start New Room
                    </Button>
                  </CardContent>
                </Card>

                {/* Team Directory (Presences) */}
                <Card className="glass-card shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="size-4.5 text-primary" />
                      Online Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto custom-scrollbar">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PresenceAvatar user={user} className="size-7" />
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">{user.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate block">{user.statusMessage || user.role}</span>
                          </div>
                        </div>
                        <span className={`size-2 rounded-full ${
                          user.presence === "available" ? "bg-emerald-500" :
                          user.presence === "busy" ? "bg-red-500" :
                          user.presence === "dnd" ? "bg-rose-600" : "bg-amber-500"
                        }`} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

              </div>

            </div>
          </TabsContent>

          {/* 2. Board Tab */}
          <TabsContent value="board" className="outline-none h-[65vh] rounded-xl overflow-hidden glass-panel">
            <TaskBoard tasks={tasks} onOpenTask={(t) => setOpenTaskId(t.id)} onAddTask={(status) => {
              setCreateDefaults({ status })
              setCreateOpen(true)
            }} />
          </TabsContent>

          {/* 3. Teams Huddles Tab */}
          <TabsContent value="huddles" className="outline-none flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Meeting listings */}
              <div className="md:col-span-2 flex flex-col gap-4">
                <Card className="glass-card shadow-xs">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Teams Meeting Channels</CardTitle>
                    <CardDescription>Scheduled and active video rooms for collaboration</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {meetings.map((meeting) => {
                      const attendees = meeting.attendeeIds.map(id => getUser(id)).filter(Boolean)
                      return (
                        <div key={meeting.id} className="flex items-center justify-between p-3 rounded-xl border bg-card/40 hover:bg-card transition-all">
                          <div className="flex items-center gap-3">
                            <div className="size-3.5 rounded-full" style={{ backgroundColor: meeting.color }} />
                            <div>
                              <p className="text-sm font-semibold">{meeting.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {meeting.start.slice(11, 16)} - {meeting.end.slice(11, 16)} &bull; {meeting.online ? "Online" : "Physical Sync"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {attendees.slice(0, 3).map((u, i) => (
                                <PresenceAvatar key={i} user={u as any} className="size-6 ring-2 ring-background" showPresence={false} />
                              ))}
                            </div>
                            {meeting.online ? (
                              <Button size="xs" onClick={() => joinHuddle(meeting.title)} className="h-7 text-xs rounded-lg">Join</Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted rounded">In-person</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Info panel */}
              <div className="flex flex-col gap-4">
                <Card className="glass-card shadow-xs bg-gradient-to-tr from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-950/50">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-white">Advanced Voice Huddle</CardTitle>
                    <CardDescription className="text-slate-400">ClickUp Style Fast Audio rooms</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-slate-300">
                    <p>Huddles are lightweight, ephemeral video and audio channels that let you quickly coordinate with team members without calendar links.</p>
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Zap className="size-3.5 text-primary" />
                        <span>Epimorphic audio and screen sharing</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="size-3.5 text-primary" />
                        <span>Interactive live sidebar logs</span>
                      </div>
                    </div>
                    <Button className="mt-4 w-full" onClick={() => startHuddle("Quick Engineering Huddle")}>
                      <Plus className="size-4" /> Start Quick Room
                    </Button>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          {/* 4. Inbox Tab */}
          <TabsContent value="inbox" className="outline-none glass-panel rounded-xl py-2">
            <ActivityFeed />
          </TabsContent>
        </Tabs>

      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatus={createDefaults.status}
        defaultTeamId={createDefaults.teamId}
      />
      <TaskDetailSheet
        taskId={openTaskId}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
      />
    </div>
  )
}

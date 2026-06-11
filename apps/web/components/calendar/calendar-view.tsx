"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Clock, Video, Users, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssigneeGroup } from "@/components/shared/assignee-group"
import { PresenceAvatar } from "@/components/shared/presence-avatar"
import { useWorkspace } from "@/lib/store"
import type { Meeting } from "@/lib/types"

export function CalendarView() {
  const { meetings, getUser, getChannel, activeProjectId } = useWorkspace()
  const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(meetings[0] || null)
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  // Generate calendar grid for month
  const gridDays = React.useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    // First day of current month
    const firstDay = new Date(year, month, 1)
    // Day of week of first day (0 = Sunday, 6 = Saturday)
    const startOffset = firstDay.getDay()
    
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate()
    
    const daysArr = []
    
    // Pad previous month days
    const prevMonthTotal = new Date(year, month, 0).getDate()
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthTotal - i)
      daysArr.push({ date: d, isCurrentMonth: false })
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i)
      daysArr.push({ date: d, isCurrentMonth: true })
    }
    
    // Pad next month days to make complete weeks (multiples of 7)
    const remaining = 42 - daysArr.length // 6 weeks grid
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      daysArr.push({ date: d, isCurrentMonth: false })
    }
    
    return daysArr
  }, [currentMonth])

  // Get meetings for specific date
  const getMeetingsForDate = (date: Date) => {
    const str = date.toISOString().slice(0, 10)
    let list = meetings.filter(m => m.start.startsWith(str))
    if (activeProjectId !== "all") {
      list = list.filter(m => {
        if (!m.channelId) return true
        const channel = getChannel(m.channelId)
        return channel && channel.teamId === activeProjectId
      })
    }
    return list
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDayClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting)
  }

  return (
    <div className="flex-grow flex flex-col md:flex-row overflow-hidden h-[calc(100vh-56px)] bg-background/30 p-6 gap-6">
      
      {/* 📅 LEFT: REDESIGNED MONTH GRID */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        
        {/* Calendar Nav Header */}
        <div className="flex items-center justify-between border bg-card/60 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <CalendarIcon className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} className="size-8">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 text-xs">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} className="size-8">
              <ChevronRight className="size-4" />
            </Button>
            <Button size="sm" onClick={() => toast.success("Event scheduler opened")} className="h-8 text-xs gap-1 shadow-xs ml-2">
              <Plus className="size-3.5" /> Event
            </Button>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="flex-1 border rounded-2xl overflow-hidden bg-card/40 flex flex-col min-h-[400px]">
          
          {/* Day Names Row */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center py-2 shrink-0">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <span key={i} className="text-xs font-semibold text-muted-foreground">{day}</span>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6">
            {gridDays.map(({ date, isCurrentMonth }, idx) => {
              const dateMeetings = getMeetingsForDate(date)
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div 
                  key={idx} 
                  className={`border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 overflow-hidden transition-colors ${
                    isCurrentMonth ? "bg-card/20" : "bg-muted/10 opacity-40"
                  } ${isToday ? "bg-primary/[0.02] border-primary/20" : "border-border/30"}`}
                >
                  <span className={`text-[10px] font-bold self-end rounded-full size-5 flex items-center justify-center ${
                    isToday ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                  }`}>
                    {date.getDate()}
                  </span>
                  
                  {/* Event Blocks inside date cell */}
                  <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {dateMeetings.slice(0, 3).map((meeting) => (
                      <div 
                        key={meeting.id}
                        onClick={() => handleDayClick(meeting)}
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold cursor-pointer border flex items-center justify-between gap-1 select-none transition-all hover:scale-[1.02]"
                        style={{ 
                          backgroundColor: `${meeting.color}18`, 
                          borderColor: `${meeting.color}40`,
                          color: meeting.color 
                        }}
                      >
                        <span className="truncate">{meeting.title}</span>
                        {meeting.online && <Video className="size-2.5 shrink-0" />}
                      </div>
                    ))}
                    {dateMeetings.length > 3 && (
                      <span className="text-[8px] font-bold text-muted-foreground pl-1">
                        +{dateMeetings.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

        </div>

      </div>

      {/* 🧐 RIGHT: DETAILS & ACTIONS SIDEBAR */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        
        {selectedMeeting ? (
          <Card className="glass-card shadow-xs h-full flex flex-col">
            <CardHeader className="pb-3 border-b bg-muted/20 rounded-t-2xl">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="size-3 rounded-full" style={{ backgroundColor: selectedMeeting.color }} />
                <span className="text-xs font-semibold text-muted-foreground">Meeting Details</span>
              </div>
              <CardTitle className="text-base font-bold leading-tight text-foreground">{selectedMeeting.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between py-4 gap-4">
              
              <div className="flex flex-col gap-4">
                {/* Time Indicator */}
                <div className="flex items-start gap-2 text-xs">
                  <Clock className="size-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Date & Time</span>
                    <span className="text-muted-foreground mt-0.5">
                      {new Date(selectedMeeting.start).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-muted-foreground mt-0.5">
                      {selectedMeeting.start.slice(11, 16)} - {selectedMeeting.end.slice(11, 16)} (UTC)
                    </span>
                  </div>
                </div>

                {/* Location / Channel */}
                <div className="flex items-start gap-2 text-xs">
                  <Video className="size-4.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Sync Medium</span>
                    <span className="text-muted-foreground mt-0.5">
                      {selectedMeeting.online ? "Simulated Video Conference" : "In-Person Physical Room"}
                    </span>
                  </div>
                </div>

                {/* Attendees list */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="size-4 text-primary" /> Attendees ({selectedMeeting.attendeeIds.length})
                  </span>
                  <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                    {selectedMeeting.attendeeIds.map(id => {
                      const user = getUser(id)
                      if (!user) return null
                      return (
                        <div key={id} className="flex items-center justify-between p-1.5 rounded-lg border bg-muted/20 text-xs">
                          <div className="flex items-center gap-2">
                            <PresenceAvatar user={user} className="size-6" showPresence={false} />
                            <span className="font-semibold">{user.name}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground bg-card border px-1.5 py-0.5 rounded">Accepted</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom quick actions */}
              <div className="border-t pt-4 mt-2">
                {selectedMeeting.online ? (
                  <Button 
                    className="w-full text-xs gap-1.5 shadow-sm"
                    onClick={() => {
                      toast.success("Initializing Live Huddle...")
                      window.dispatchEvent(new CustomEvent("meetspace:huddle", { detail: { name: selectedMeeting.title } }))
                    }}
                  >
                    <Video className="size-4" /> Join Live Huddle
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full text-xs" disabled>
                    In-person meeting
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card shadow-xs h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
            Select a calendar event block to inspect meeting info.
          </Card>
        )}

      </div>

    </div>
  )
}

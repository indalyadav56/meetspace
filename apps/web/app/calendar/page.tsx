import { PageHeader } from "@/components/page-header"
import { CalendarView } from "@/components/calendar/calendar-view"

export default function CalendarPage() {
  return (
    <div className="flex flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Calendar</h1>
      </PageHeader>
      <CalendarView />
    </div>
  )
}

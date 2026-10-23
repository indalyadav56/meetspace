import { addDays, setHours, startOfDay } from 'date-fns'
import type { BoardItem } from './types'

/** Tools offered during sign-up; each one gets starter content in the new workspace. */
export type StarterTool = 'docs' | 'chat' | 'calls' | 'whiteboards' | 'goals' | 'forms' | 'sprints' | 'automations'

export const STARTER_TOOLS: { key: StarterTool; name: string; description: string }[] = [
  { key: 'docs', name: 'Docs', description: 'A welcome doc with your team’s getting-started notes.' },
  { key: 'chat', name: 'Chat', description: 'An #announcements channel next to #general.' },
  { key: 'calls', name: 'Calls & meetings', description: 'A kickoff meeting tomorrow with everyone you invite.' },
  { key: 'whiteboards', name: 'Whiteboards', description: 'A brainstorm board with a few sticky notes.' },
  { key: 'goals', name: 'Goals', description: 'A first goal that tracks progress on your tasks.' },
  { key: 'forms', name: 'Forms', description: 'A request form that turns responses into tasks.' },
  { key: 'sprints', name: 'Sprints', description: 'A two-week sprint, started and ready to plan.' },
  { key: 'automations', name: 'Automations', description: 'New tasks are assigned to you automatically.' },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export function welcomeDoc(workspace: string) {
  return `<h1>Welcome to ${esc(workspace)}</h1>
<p>This is your team’s home for tasks, docs, chat and calls. A few things to try first:</p>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>Open a List in the sidebar and add your first task (press <strong>C</strong> anywhere).</p></li>
<li data-type="taskItem" data-checked="false"><p>Say hello in <strong>#general</strong>.</p></li>
<li data-type="taskItem" data-checked="false"><p>Start a call from Chat → Calls &amp; meetings.</p></li>
<li data-type="taskItem" data-checked="false"><p>Ask the AI assistant (⌘J) what’s due this week.</p></li>
</ul>
<h2>How we work</h2>
<p>Write your team’s norms here: where decisions are recorded, how you hand off work, and when you meet.</p>`
}

/** Tomorrow at 10:00 local time. */
export function kickoffStart() {
  return setHours(startOfDay(addDays(new Date(), 1)), 10).toISOString()
}

export function brainstormItems(): BoardItem[] {
  const notes = ['Goals for this quarter', 'What’s slowing us down?', 'Ideas to try', 'Questions for the team']
  const colors = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecdd3']
  return notes.map((text, i) => ({ id: `n${i}`, kind: 'note', x: 60 + (i % 2) * 260, y: 60 + Math.floor(i / 2) * 200, w: 220, h: 150, color: colors[i], text }))
}


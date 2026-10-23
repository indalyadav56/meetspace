import type { Priority, StatusType } from './types'

export interface TemplateTask {
  title: string
  status: StatusType
  priority?: Priority
  tags?: string[]
  /** due date offset in days from today */
  due?: number
  subtasks?: string[]
}

export interface ListTemplate {
  key: string
  name: string
  emoji: string
  description: string
  tasks: TemplateTask[]
}

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    key: 'sprint',
    name: 'Sprint',
    emoji: '🏃',
    description: 'A two-week sprint with planning, build and review tasks.',
    tasks: [
      { title: 'Sprint planning', status: 'done', due: 0, tags: ['ritual'] },
      { title: 'Groom top 10 backlog items', status: 'active', due: 1, priority: 'high' },
      { title: 'Implement highest-priority story', status: 'open', due: 6, priority: 'high', subtasks: ['Write tests', 'Code review', 'Deploy to staging'] },
      { title: 'Fix regressions from last release', status: 'open', due: 4, priority: 'urgent', tags: ['bug'] },
      { title: 'Sprint demo', status: 'open', due: 13, tags: ['ritual'] },
      { title: 'Retrospective', status: 'open', due: 13, tags: ['ritual'] },
    ],
  },
  {
    key: 'bugs',
    name: 'Bug tracker',
    emoji: '🐞',
    description: 'Triage, reproduce and fix incoming bugs.',
    tasks: [
      { title: 'Triage new reports', status: 'active', priority: 'high', due: 0, tags: ['triage'] },
      { title: 'Login button unresponsive on slow networks', status: 'open', priority: 'urgent', due: 1, tags: ['bug'] },
      { title: 'Export CSV misses custom fields', status: 'open', priority: 'normal', due: 5, tags: ['bug'] },
      { title: 'Typo in onboarding email', status: 'done', priority: 'low', tags: ['bug'] },
    ],
  },
  {
    key: 'content',
    name: 'Content calendar',
    emoji: '🗓️',
    description: 'Plan, draft and publish content on a schedule.',
    tasks: [
      { title: 'Brainstorm next month’s topics', status: 'open', due: 2 },
      { title: 'Draft: customer story', status: 'active', due: 5, tags: ['blog'] },
      { title: 'Design social graphics', status: 'open', due: 6, tags: ['social'] },
      { title: 'Schedule newsletter', status: 'open', due: 9, tags: ['email'] },
    ],
  },
  {
    key: 'hiring',
    name: 'Hiring pipeline',
    emoji: '🧑‍💼',
    description: 'Move candidates from sourcing to offer.',
    tasks: [
      { title: 'Write job description', status: 'done' },
      { title: 'Source 20 candidates', status: 'active', due: 7 },
      { title: 'Phone screens', status: 'open', due: 10, subtasks: ['Candidate A', 'Candidate B', 'Candidate C'] },
      { title: 'Onsite interviews', status: 'open', due: 17 },
      { title: 'Make offer', status: 'open', due: 21, priority: 'high' },
    ],
  },
  {
    key: 'launch',
    name: 'Product launch',
    emoji: '🚀',
    description: 'Everything from messaging to launch-day checklist.',
    tasks: [
      { title: 'Positioning & messaging', status: 'active', due: 3, priority: 'high' },
      { title: 'Landing page', status: 'open', due: 8 },
      { title: 'Press kit', status: 'open', due: 10 },
      { title: 'Launch-day checklist', status: 'open', due: 14, priority: 'urgent', subtasks: ['Enable feature flags', 'Publish blog post', 'Post on social'] },
    ],
  },
  {
    key: 'crm',
    name: 'Sales pipeline',
    emoji: '💼',
    description: 'Track deals from first call to closed-won.',
    tasks: [
      { title: 'Qualify inbound lead: Northwind', status: 'active', due: 1, priority: 'high', tags: ['lead'] },
      { title: 'Discovery call: Bluepeak', status: 'open', due: 3, priority: 'normal', tags: ['discovery'], subtasks: ['Send agenda', 'Share pricing deck'] },
      { title: 'Send proposal: Lumen & Co', status: 'open', due: 5, priority: 'high', tags: ['proposal'] },
      { title: 'Negotiate renewal: Fernway', status: 'open', due: 9, priority: 'normal', tags: ['renewal'] },
      { title: 'Closed won: Quarry pilot', status: 'done', tags: ['won'] },
    ],
  },
  {
    key: 'support',
    name: 'Customer support',
    emoji: '🎧',
    description: 'Answer tickets and turn feedback into fixes.',
    tasks: [
      { title: 'Reply to unanswered tickets', status: 'active', due: 0, priority: 'urgent', tags: ['inbox'] },
      { title: 'Can’t reset password on mobile', status: 'open', due: 1, priority: 'high', tags: ['ticket'] },
      { title: 'Billing question: annual plan refund', status: 'open', due: 2, priority: 'normal', tags: ['ticket', 'billing'] },
      { title: 'Update help-center article on invites', status: 'open', due: 6, priority: 'low', tags: ['docs'] },
      { title: 'Weekly feedback round-up', status: 'open', due: 4, priority: 'normal', tags: ['feedback'] },
    ],
  },
  {
    key: 'roadmap',
    name: 'Project roadmap',
    emoji: '🗺️',
    description: 'Plan milestones and track a project end to end.',
    tasks: [
      { title: 'Kickoff and goals', status: 'done', tags: ['milestone'] },
      { title: 'Requirements and scope', status: 'active', due: 4, priority: 'high', tags: ['milestone'], subtasks: ['Interview stakeholders', 'Write spec', 'Sign-off'] },
      { title: 'Design', status: 'open', due: 14, priority: 'normal', tags: ['milestone'] },
      { title: 'Build', status: 'open', due: 35, priority: 'high', tags: ['milestone'] },
      { title: 'Launch and review', status: 'open', due: 49, priority: 'normal', tags: ['milestone'] },
    ],
  },
  {
    key: 'marketing',
    name: 'Marketing campaign',
    emoji: '📣',
    description: 'Run a campaign across channels with a clear owner per piece.',
    tasks: [
      { title: 'Define audience and message', status: 'active', due: 2, priority: 'high', tags: ['strategy'] },
      { title: 'Landing page copy', status: 'open', due: 6, priority: 'normal', tags: ['web'] },
      { title: 'Email sequence (3 emails)', status: 'open', due: 8, priority: 'normal', tags: ['email'], subtasks: ['Email 1: announce', 'Email 2: story', 'Email 3: last call'] },
      { title: 'Paid social ads', status: 'open', due: 10, priority: 'normal', tags: ['ads'] },
      { title: 'Campaign results report', status: 'open', due: 24, priority: 'low', tags: ['report'] },
    ],
  },
  {
    key: 'events',
    name: 'Event planning',
    emoji: '🎉',
    description: 'Organise an event, from venue to follow-up.',
    tasks: [
      { title: 'Pick date and budget', status: 'done', tags: ['planning'] },
      { title: 'Book venue', status: 'active', due: 5, priority: 'high', tags: ['venue'] },
      { title: 'Speaker and agenda', status: 'open', due: 12, priority: 'normal', tags: ['content'], subtasks: ['Confirm speakers', 'Publish agenda'] },
      { title: 'Send invitations', status: 'open', due: 15, priority: 'high', tags: ['invites'] },
      { title: 'Post-event survey', status: 'open', due: 32, priority: 'low', tags: ['follow-up'] },
    ],
  },
  {
    key: 'personal',
    name: 'Personal to-dos',
    emoji: '✅',
    description: 'A simple list for your own tasks and errands.',
    tasks: [
      { title: 'Plan the week', status: 'active', due: 0, priority: 'normal' },
      { title: 'Book dentist appointment', status: 'open', due: 3, priority: 'low', tags: ['errand'] },
      { title: 'Read one chapter', status: 'open', due: 1, tags: ['habit'] },
      { title: 'Pay bills', status: 'open', due: 5, priority: 'high', tags: ['home'] },
    ],
  },
  {
    key: 'onboarding',
    name: 'Employee onboarding',
    emoji: '👋',
    description: 'Welcome new teammates with a repeatable checklist.',
    tasks: [
      { title: 'Prepare laptop and accounts', status: 'active', due: 0, priority: 'high', tags: ['IT'] },
      { title: 'Welcome meeting with the team', status: 'open', due: 1, priority: 'normal', tags: ['people'] },
      { title: 'First-week buddy check-ins', status: 'open', due: 5, priority: 'normal', tags: ['people'], subtasks: ['Day 1', 'Day 3', 'Day 5'] },
      { title: '30-day goals', status: 'open', due: 7, priority: 'normal', tags: ['goals'] },
      { title: 'Onboarding feedback survey', status: 'open', due: 30, priority: 'low', tags: ['feedback'] },
    ],
  },
]

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
]

import { format } from 'date-fns'

export interface DocTemplate {
  key: string
  title: string
  emoji: string
  hint: string
  content: () => string
}

const today = () => format(new Date(), 'MMMM d, yyyy')

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: 'meeting',
    title: 'Meeting notes',
    emoji: '🗓️',
    hint: 'Agenda, notes and action items',
    content: () => `
<p><strong>Date:</strong> ${today()} · <strong>Attendees:</strong> </p>
<h2>Agenda</h2><ol><li><p></p></li></ol>
<h2>Notes</h2><p></p>
<h2>Decisions</h2><div data-callout="" data-tone="success"><p>What did we agree on?</p></div>
<h2>Action items</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
  },
  {
    key: 'brief',
    title: 'Project brief',
    emoji: '🚀',
    hint: 'Goals, scope, timeline, owners',
    content: () => `
<div data-callout="" data-tone="info"><p><strong>TL;DR</strong> — one sentence on what we are building and why.</p></div>
<h2>Problem</h2><p></p>
<h2>Goals</h2><ul><li><p></p></li></ul>
<h2>Out of scope</h2><ul><li><p></p></li></ul>
<h2>Timeline</h2>
<table><tbody><tr><th><p>Milestone</p></th><th><p>Owner</p></th><th><p>Date</p></th></tr><tr><td><p>Kick-off</p></td><td><p></p></td><td><p>${today()}</p></td></tr><tr><td><p>Launch</p></td><td><p></p></td><td><p></p></td></tr></tbody></table>
<h2>Risks</h2><div data-callout="" data-tone="warning"><p></p></div>`,
  },
  {
    key: 'prd',
    title: 'Product spec',
    emoji: '📐',
    hint: 'Requirements and user stories',
    content: () => `
<h2>Background</h2><p></p>
<h2>User stories</h2><ul><li><p>As a <em>role</em>, I want <em>goal</em> so that <em>reason</em>.</p></li></ul>
<h2>Requirements</h2>
<table><tbody><tr><th><p>Requirement</p></th><th><p>Priority</p></th><th><p>Notes</p></th></tr><tr><td><p></p></td><td><p>Must</p></td><td><p></p></td></tr><tr><td><p></p></td><td><p>Should</p></td><td><p></p></td></tr></tbody></table>
<h2>Success metrics</h2><ul><li><p></p></li></ul>
<h2>Open questions</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
  },
  {
    key: 'retro',
    title: 'Retrospective',
    emoji: '🔁',
    hint: 'What went well, what to change',
    content: () => `
<p><strong>Sprint:</strong>  · <strong>Date:</strong> ${today()}</p>
<h2>😀 What went well</h2><ul><li><p></p></li></ul>
<h2>😕 What didn’t</h2><ul><li><p></p></li></ul>
<h2>💡 Ideas</h2><ul><li><p></p></li></ul>
<h2>Next steps</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
  },
  {
    key: 'weekly',
    title: 'Weekly update',
    emoji: '📣',
    hint: 'Progress, plans and blockers',
    content: () => `
<p><strong>Week of ${today()}</strong></p>
<h2>Shipped</h2><ul><li><p></p></li></ul>
<h2>In progress</h2><ul><li><p></p></li></ul>
<h2>Next week</h2><ul><li><p></p></li></ul>
<h2>Blockers</h2><div data-callout="" data-tone="danger"><p>Nothing blocked right now.</p></div>`,
  },
]

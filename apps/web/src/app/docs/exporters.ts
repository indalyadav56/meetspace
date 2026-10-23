/** Converts the editor's HTML into Markdown. Covers what the doc editor can produce. */
export function htmlToMarkdown(html: string) {
  const root = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  return blocks(root, '').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function inline(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').replace(/([*_`[\]])/g, '\\$1')
  if (!(n instanceof HTMLElement)) return ''
  const inner = () => Array.from(n.childNodes).map(inline).join('')
  switch (n.tagName) {
    case 'STRONG':
    case 'B':
      return `**${inner()}**`
    case 'EM':
    case 'I':
      return `*${inner()}*`
    case 'S':
    case 'DEL':
      return `~~${inner()}~~`
    case 'CODE':
      return '`' + (n.textContent ?? '') + '`'
    case 'A': {
      const href = n.getAttribute('href') ?? ''
      return `[${inner()}](${href.startsWith('/') ? location.origin + href : href})`
    }
    case 'IMG':
      return `![${n.getAttribute('alt') ?? ''}](${n.getAttribute('src') ?? ''})`
    case 'BR':
      return '  \n'
    default:
      return inner()
  }
}

function list(el: HTMLElement, indent: string): string {
  const ordered = el.tagName === 'OL'
  const tasks = el.getAttribute('data-type') === 'taskList'
  return (
    Array.from(el.children)
      .map((li, i) => {
        const marker = tasks ? `- [${li.getAttribute('data-checked') === 'true' ? 'x' : ' '}] ` : ordered ? `${i + 1}. ` : '- '
        const body = blocks(li as HTMLElement, indent + '  ').trim()
        return indent + marker + body
      })
      .join('\n') + '\n\n'
  )
}

function table(el: HTMLElement): string {
  const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => inline(c).replace(/\|/g, '\\|').trim()))
  if (!rows.length) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`
  return [line(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n') + '\n\n'
}

function blocks(el: HTMLElement, indent: string): string {
  let out = ''
  for (const n of Array.from(el.childNodes)) {
    if (!(n instanceof HTMLElement)) {
      out += inline(n)
      continue
    }
    switch (n.tagName) {
      case 'H1':
      case 'H2':
      case 'H3':
        out += `${'#'.repeat(Number(n.tagName[1]))} ${inline(n)}\n\n`
        break
      case 'P':
        out += inline(n) + '\n\n'
        break
      case 'UL':
      case 'OL':
        out += list(n, indent)
        break
      case 'LABEL':
        break
      case 'DIV':
        if (n.hasAttribute('data-callout')) out += blocks(n, '').trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n'
        else out += blocks(n, indent)
        break
      case 'BLOCKQUOTE':
        out += blocks(n, '').trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n'
        break
      case 'PRE': {
        const code = n.querySelector('code')
        const lang = /language-(\S+)/.exec(code?.className ?? '')?.[1] ?? ''
        out += '```' + (lang === 'plaintext' ? '' : lang) + '\n' + (n.textContent ?? '').replace(/\n$/, '') + '\n```\n\n'
        break
      }
      case 'HR':
        out += '---\n\n'
        break
      case 'TABLE':
        out += table(n)
        break
      case 'IMG':
        out += inline(n) + '\n\n'
        break
      default:
        out += inline(n)
    }
  }
  return out
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileName = (title: string) => (title.trim() || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)

/** A standalone HTML page for the doc, used for download and print. */
export function standaloneHtml(title: string, body: string) {
  const esc = title.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title><style>
body{font:15px/1.65 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1c1917}
h1,h2,h3{line-height:1.25}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d6d3d1;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f5f5f4}
pre{background:#f5f5f4;padding:12px;border-radius:8px;overflow:auto}code{background:#f5f5f4;padding:1px 4px;border-radius:4px}pre code{background:none;padding:0}
blockquote{border-left:3px solid #a8a29e;margin:0;padding-left:1em;color:#57534e}img{max-width:100%;border-radius:8px}
[data-callout]{border-radius:8px;padding:8px 14px;margin:10px 0;background:#eff6ff;border-left:4px solid #3b82f6}[data-tone=success]{background:#f0fdf4;border-color:#22c55e}[data-tone=warning]{background:#fffbeb;border-color:#f59e0b}[data-tone=danger]{background:#fef2f2;border-color:#ef4444}
ul[data-type=taskList]{list-style:none;padding-left:0}ul[data-type=taskList] li{display:flex;gap:8px}ul[data-type=taskList] li p{margin:0}mark{border-radius:2px}
</style></head><body><h1>${esc}</h1>${body}</body></html>`
}

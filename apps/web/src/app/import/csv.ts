/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, a BOM. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

/** Rows as records. Repeated headers (Jira's "Labels", "Labels") collect every value. */
export function records(rows: string[][]): { headers: string[]; get: (row: string[], ...names: string[]) => string; all: (row: string[], name: string) => string[]; rows: string[][] } {
  const headers = (rows[0] ?? []).map((h) => h.trim())
  const lower = headers.map((h) => h.toLowerCase())
  const get = (row: string[], ...names: string[]) => {
    for (const n of names) {
      const i = lower.indexOf(n.toLowerCase())
      if (i >= 0 && row[i]?.trim()) return row[i].trim()
    }
    return ''
  }
  const all = (row: string[], name: string) => lower.flatMap((h, i) => (h === name.toLowerCase() && row[i]?.trim() ? [row[i].trim()] : []))
  return { headers, get, all, rows: rows.slice(1) }
}

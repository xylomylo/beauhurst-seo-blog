import Papa from 'papaparse'

export type Row = Record<string, string>
export interface Stat { label: string; value: string }
export interface Breakdown { column: string; counts: { label: string; count: number }[] }
export interface Analysis {
  nameCol: string
  metricCol: string | null
  tableColumns: string[]
  rows: Row[]
  stats: Stat[]
  breakdowns: Breakdown[]
  constants: Record<string, string>
}

const UNITS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }

// "£1.2m", "3,400,000", "5bn" -> number
export function toNumber(v?: string): number | null {
  if (!v) return null
  const m = v.replace(/[£$€,\s]/g, '').match(/^(-?\d+(?:\.\d+)?)(k|m|bn|b)?$/i)
  if (!m) return null
  return parseFloat(m[1]!) * (m[2] ? UNITS[m[2].toLowerCase()]! : 1)
}

const compact = (n: number, prefix = '') =>
  prefix + new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Count values in a column (optionally splitting "a; b; c" tags), top 8
function tallyTop(rows: Row[], column: string, split = false) {
  const tally: Record<string, number> = {}
  for (const r of rows) {
    const raw = r[column] ?? ''
    const keys = split ? raw.split(';') : [raw]
    for (const key of keys) {
      const k = key.trim() || 'Unknown'
      tally[k] = (tally[k] ?? 0) + 1
    }
  }
  return Object.entries(tally)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}
export function analyseCsv(csv: string): Analysis {
  const { data, meta } = Papa.parse<Row>(csv.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  })
  const headers = (meta.fields ?? []).filter(Boolean)
  if (!data.length || !headers.length) {
    throw createError({ statusCode: 400, statusMessage: 'CSV is empty or has no header row' })
  }

  // 1. Infer column types from the values
    // 1. Infer column types from the values
  const numeric: string[] = []
  const category: string[] = []
  const list: string[] = []                       // "a; b; c" tag columns
  const text: string[] = []
  const constants: Record<string, string> = {}    // same value in every row
  for (const h of headers) {
    const vals = data.map(r => r[h]?.trim()).filter(Boolean) as string[]
    const numShare = vals.filter(v => toNumber(v) !== null).length / (vals.length || 1)
    const unique = new Set(vals).size
    if (unique === 1 && vals.length > 1) constants[h] = vals[0]!
    else if (numShare >= 0.8) numeric.push(h)
    else if (unique <= 15 && unique < vals.length * 0.5) category.push(h)
    else if (vals.filter(v => v.includes(';')).length / (vals.length || 1) >= 0.3) list.push(h)
    else text.push(h)
  }

  // 2. Pick the important columns from the header names
  const find = (cols: string[], re: RegExp) => cols.find(c => re.test(c))
  const rankCol = find(numeric, /rank|position|^#$/i)
  const yearCol = find(numeric, /year|founded|incorporat/i)
  const nameCol = find(text, /company|name|organi[sz]ation/i) ?? text[0] ?? headers[0]!
  const metricCol =
    find(numeric, /fund|raised|amount|invest|revenue|valuation|turnover|total/i) ??
    numeric.find(c => c !== rankCol && c !== yearCol && !/id$/i.test(c)) ??
    null

    // 3. Sort (respect existing rank, else by metric) and number the rows
  let rows = [...data]
  if (rankCol) rows.sort((a, b) => (toNumber(a[rankCol]) ?? 0) - (toNumber(b[rankCol]) ?? 0))
  else if (metricCol) rows.sort((a, b) => (toNumber(b[metricCol]) ?? 0) - (toNumber(a[metricCol]) ?? 0))
  rows = rows.map((r, i) => {
    const copy: Row = { Rank: String(i + 1), ...r }
    if (rankCol && rankCol !== 'Rank') delete copy[rankCol]
    return copy
  })

  // 4. Columns shown in the table (max 6)
  const tableColumns = ['Rank', nameCol, metricCol, ...category, yearCol, ...numeric, ...text]
    .filter((c, i, arr): c is string => !!c && (c === 'Rank' || c !== rankCol) && arr.indexOf(c) === i)
    .slice(0, 6)

  // 5. Headline stats
  const stats: Stat[] = [{ label: 'Companies ranked', value: String(rows.length) }]

  if (metricCol) {
    const vals = rows.map(r => toNumber(r[metricCol])).filter((n): n is number => n !== null)
    const sum = vals.reduce((a, b) => a + b, 0)
    const asc = [...vals].sort((a, b) => a - b)
    const median = asc[Math.floor(asc.length / 2)] ?? 0
    const top10 = [...vals].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0)
    const sample = metricCol + (rows[0]?.[metricCol] ?? '')
    const cur = /£|gbp/i.test(sample) ? '£' : /\$|usd/i.test(sample) ? '$' : ''
        const label = metricCol.replace(/\(.*?\)/g, '').trim().toLowerCase()
    const leader = rows[0]!

    stats.push(
      { label: `Combined ${label}`, value: compact(sum, cur) },
      { label: `Average ${label}`, value: compact(sum / vals.length, cur) },
      { label: `Median ${label}`, value: compact(median, cur) },
      { label: 'Share held by top 10', value: pct(top10 / sum) },
      { label: 'Raised by top 10', value: compact(top10, cur) },
      { label: `Leader: ${leader[nameCol]}`, value: `${pct((toNumber(leader[metricCol]) ?? 0) / sum)} of total` },
    )
  }

  if (yearCol) {
    const years = rows
      .map(r => toNumber(r[yearCol]))
      .filter((n): n is number => !!n && n > 1800)
      .sort((a, b) => a - b)
    if (years.length) {
      stats.push(
        { label: `Median ${yearCol}`, value: String(years[Math.floor(years.length / 2)]) },
        { label: `Earliest ${yearCol}`, value: String(years[0]) },
      )
    }
  }

    // 6. Breakdowns: categories + split tag lists
  const breakdowns: Breakdown[] = [
    ...category.map(column => ({ column, counts: tallyTop(rows, column) })),
    ...list.map(column => ({column,counts: tallyTop(rows, column, true).filter(c => c.count < rows.length * 0.9),})),
  ]

  for (const b of breakdowns) {
    const top = b.counts[0]
    if (top) stats.push({ label: `Most common ${b.column}`, value: `${top.label} (${top.count})` })
  }

    return { nameCol, metricCol, tableColumns, rows, stats, breakdowns, constants }

}

// e.g. "Seed" when every row has the same Stage
export const getStage = (a: Analysis) =>
  Object.entries(a.constants).find(([k]) => /stage|round/i.test(k))?.[1] ?? ''
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
  const numeric: string[] = []
  const category: string[] = []
  const text: string[] = []
  for (const h of headers) {
    const vals = data.map(r => r[h]?.trim()).filter(Boolean) as string[]
    const numShare = vals.filter(v => toNumber(v) !== null).length / (vals.length || 1)
    const unique = new Set(vals).size
    if (numShare >= 0.8) numeric.push(h)
    else if (unique <= 15 && unique < vals.length * 0.5) category.push(h)
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

  // TEMP: inspect what was detected (part C replaces this)
  return { headers, numeric, category, text, rankCol, yearCol, nameCol, metricCol } as any
}
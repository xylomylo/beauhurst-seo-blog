import type { Analysis } from './analyse'

export interface BlogCopy {
  title: string
  metaDescription: string
  intro: string
  sections: { heading: string; body: string }[]
  faq: { question: string; answer: string }[]
}

// "100 UK seed-stage Fintech companies"
function subjectOf(industry: string, a: Analysis) {
  const stage = getStage(a)
  return `${a.rows.length} UK ${stage ? `${stage.toLowerCase()}-stage ` : ''}${industry} companies`
}

// Turn the computed analysis into plain-text facts for the prompt
function buildFacts(a: Analysis) {
  const descCol = Object.keys(a.rows[0] ?? {}).find(k => /desc|summary|about/i.test(k))
  const top = a.rows.slice(0, 10).map(r =>
    [`${r.Rank}. ${r[a.nameCol]}`, a.metricCol && r[a.metricCol], descCol && r[descCol]]
      .filter(Boolean)
      .join(' – '),
  )
  return [
    'Dataset context:',
    ...Object.entries(a.constants).map(([k, v]) => `- Every company has ${k}: ${v}`),
    'Key statistics:',
    ...a.stats.map(s => `- ${s.label}: ${s.value}`),
    'Breakdowns (number of companies):',
    ...a.breakdowns.map(b => `- By ${b.column}: ${b.counts.map(c => `${c.label} (${c.count})`).join(', ')}`),
    'Top 10:',
    ...top,
  ].join('\n')
}

function buildPrompt(industry: string, a: Analysis) {
  const year = new Date().getFullYear()
  const keyword = `top UK ${getStage(a).toLowerCase()} ${industry} companies`.replace(/\s+/g, ' ')
  return `You are an SEO content writer for Beauhurst, a UK data platform on private, high-growth companies.
Write a data-led blog post about the top ${subjectOf(industry, a)}${a.metricCol ? `, ranked by ${a.metricCol.toLowerCase()}` : ''}.

RULES
- Use ONLY the facts below. Never invent numbers, companies, dates or funding rounds.
- UK English. Plain text only, no markdown. Expert but friendly tone.
- Avoid AI prose style and em dashes, semicolons or other popular AI indicators.
- Primary keyword: "${keyword}". Use it in the title, meta description, intro and one heading.

FACTS
${buildFacts(a)}

Return ONLY JSON in exactly this shape:
{
  "title": "max 60 characters, includes the primary keyword and ${year}",
  "metaDescription": "140-155 characters, includes the primary keyword",
  "intro": "two short paragraphs separated by a blank line",
  "sections": [{ "heading": "string", "body": "one or two paragraphs" }],
  "faq": [{ "question": "string", "answer": "string" }]
}
Write 3-4 sections (e.g. the leaders, how concentrated the money is, where companies are based, which sub-sectors dominate) and 3 FAQs people would search for.`
}

// Used when there's no API key or the LLM call fails, so the page always generates
export function fallbackCopy(industry: string, a: Analysis): BlogCopy {
  const subject = subjectOf(industry, a)
  const leader = a.rows[0]?.[a.nameCol] ?? 'The leading company'
  const by = a.metricCol ? ` by ${a.metricCol.toLowerCase()}` : ''
  return {
    title: `Top ${subject} (${new Date().getFullYear()})`,
    metaDescription: `Ranking of the top ${subject}${by}, with key statistics, breakdowns and insights from the data.`.slice(0, 155),
    intro: `This is our ranking of the top ${subject}${by}. ${leader} leads the list.\n\nBelow you'll find headline statistics, breakdowns and the full ranking table.`,
    sections: [{ heading: 'Key findings', body: a.stats.slice(1).map(s => `${s.label}: ${s.value}.`).join(' ') }],
    faq: [{ question: `Which company ranks first?`, answer: `${leader} ranks first in this dataset${by}.` }],
  }
}

export async function generateCopy(industry: string, a: Analysis): Promise<BlogCopy> {
  const fallback = fallbackCopy(industry, a)
  const { geminiApiKey, geminiModel } = useRuntimeConfig()
    if (!geminiApiKey) {
    console.warn('[generateCopy] No NUXT_GEMINI_API_KEY found; using template copy')
    return fallback
  }

  try {
    const res = await $fetch<any>(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': geminiApiKey },
        body: {
          contents: [{ parts: [{ text: buildPrompt(industry, a) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
        },
        timeout: 30000,
      },
    )
    const text = res?.candidates?.[0]?.content?.parts?.[0]?.text
    const copy = JSON.parse(text) as Partial<BlogCopy>
    if (!copy.title || !copy.intro || !copy.sections?.length) throw new Error('LLM response missing fields')
    return { ...fallback, ...copy }
  } catch (err) {
    console.error('[generateCopy] Falling back to template copy:', err)
    return fallback
  }
}
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
      .join(' - '),
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
- Use ONLY the facts below. Never invent numbers, companies, dates or funding rounds.
- Copy numbers exactly as given. Do NOT calculate new numbers (no sums, differences or percentages).
- The data is a single snapshot: do not claim growth, trends or change over time.

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

const RETRYABLE = [429, 500, 503]

// Shared by every provider: parse the JSON and check the fields we need
function parseCopy(text: string | undefined): Partial<BlogCopy> {
  const copy = JSON.parse(text ?? '') as Partial<BlogCopy>
  if (!copy.title || !copy.intro || (copy.sections?.length ?? 0) < 2) throw new Error('LLM response missing fields')
  return copy
}

async function callGemini(model: string, apiKey: string, prompt: string) {
  const res = await $fetch<any>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      },
      timeout: 30000,
    },
  )
  return parseCopy(res?.candidates?.[0]?.content?.parts?.[0]?.text)
}

async function callOllama(model: string, baseUrl: string, prompt: string) {
  const res = await $fetch<any>(`${baseUrl}/api/generate`, {
    method: 'POST',
    body: { model, prompt, stream: false, format: 'json', options: { temperature: 0.6 } },
    timeout: 180000, // local models are slower
  })
  return parseCopy(res?.response)
}

// Pull every number out of a piece of text ("£30.3m", "33%", "78", "2026")
function extractNumbers(text: string): number[] {
  return [...text.matchAll(/£?\d[\d,]*(?:\.\d+)?(?:bn|m|k)?/gi)]
    .map(m => toNumber(m[0]))
    .filter((n): n is number => n !== null)
}

// Numbers in the copy that don't match (±1%) any number we supplied in the prompt
function findUngroundedNumbers(copy: Partial<BlogCopy>, prompt: string): number[] {
  const allowed = extractNumbers(prompt)
  return extractNumbers(JSON.stringify(copy)).filter(
    n => n > 10 && !allowed.some(a => Math.abs(a - n) <= Math.abs(a) * 0.01),
  )
}

export async function generateCopy(industry: string, a: Analysis): Promise<BlogCopy> {
  const fallback = fallbackCopy(industry, a)
  const { geminiApiKey, llmModels, ollamaUrl } = useRuntimeConfig()
  const prompt = buildPrompt(industry, a)
  const models = String(llmModels).split(',').map(m => m.trim()).filter(Boolean)

  for (const model of models) {
    const isOllama = model.startsWith('ollama:')
    if (!isOllama && !geminiApiKey) {
      console.warn(`[generateCopy] Skipping ${model}: no NUXT_GEMINI_API_KEY`)
      continue
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const copy = isOllama
          ? await callOllama(model.slice('ollama:'.length), ollamaUrl, prompt)
          : await callGemini(model, geminiApiKey, prompt)
        const ungrounded = findUngroundedNumbers(copy, prompt)
        if (ungrounded.length) {
          const e: any = new Error(`Ungrounded numbers: ${ungrounded.join(', ')}`)
          e.retryable = true
          throw e
        }
        if (!copy.title || copy.title.length > 60) copy.title = fallback.title
        if (!copy.metaDescription || copy.metaDescription.length < 120 || copy.metaDescription.length > 160) {
          copy.metaDescription = fallback.metaDescription
        }
        if (copy.intro) copy.intro = copy.intro.split(/\n\s*\n/).slice(0, 2).join('\n\n')
        console.info(`[generateCopy] Success with ${model}`)
        return { ...fallback, ...copy }
      } catch (err: any) {
        const status = err?.statusCode ?? err?.status
        console.warn(`[generateCopy] ${model} attempt ${attempt} failed:`, status, err?.data?.error?.message ?? err?.message)
        if (!RETRYABLE.includes(status) && !err.retryable) break
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt))
      }
    }
  }

  console.error('[generateCopy] All models failed; using template copy')
  return fallback
}
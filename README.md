# AI-Powered SEO Blog Generator

Upload a CSV of companies, and this Nuxt app turns it into a server-rendered, SEO-optimised blog page with a ranking table, statistics and AI-written copy. It works for any industry dataset, not just fintech.

## Demo

1. Start the app (see Setup) and go to `/upload`
2. Choose a CSV and type the industry name (e.g. "Healthtech")
3. You are redirected to the new blog page, e.g. `/blog/top-100-uk-seed-fintech-companies`

No rebuild is needed. New pages are rendered on request from stored data.

Sample files are in `/samples`:
- `fintech.csv` is the dataset from the brief
- `healthtech-test.csv` is a small fictional dataset with different column names, no rank column and unsorted rows. I used it to test that nothing is hardcoded to fintech.

## How it works

```
CSV upload
  → schema inference      which column is the name, the metric, a category, a tag list?
  → stats in code         totals, average, median, concentration, breakdowns
  → LLM copy              title, meta description, intro, sections, FAQs
  → validation            fact-check numbers, enforce structure and lengths
  → saved as JSON         data/blogs/<slug>
  → server-rendered page  same Nuxt template for every dataset
```

### 1. Schema inference (`server/utils/analyse.ts`)
The code never assumes column names. It looks at each column's values and header:
- 80%+ of values parse as numbers → numeric (handles "£1.2m", "3,400,000")
- Few unique values → category (e.g. Region)
- Values separated by ";" → tag list (e.g. "Banking; Payments"), split and counted
- The same value in every row → a constant. In the fintech data every company is Seed stage, so the page is titled "seed-stage" instead of implying these are the top fintechs overall.

Header names then pick the important columns, e.g. `/company|name|organisation/` for the name and `/fund|raised|revenue|valuation/` for the ranking metric. If there is no rank column, rows are ranked by the metric.

### 2. Numbers are computed in code, never by the LLM
All statistics are calculated in TypeScript. The LLM only receives these facts and writes prose around them. LLMs are known to get numbers wrong, so the code owns the truth.

### 3. LLM copy (`server/utils/llm.ts`)
Models are tried in order from config (`NUXT_LLM_MODELS`):

`gemini-3.5-flash → gemini-flash-latest → ollama:llama3.2 → template copy`

- Transient errors (429, 5xx, bad output) are retried with backoff. Permanent errors (400, 404) skip to the next model.
- If every model fails, a template built from the same stats is used, so a page is always generated.
- Ollama gets a JSON Schema (structured outputs), so the response must have 3–4 sections and 3 FAQs.

### 4. Validation: the LLM proposes, the code enforces
- **Fact-check guard:** every number in the generated copy must match (±1%) a number given in the prompt. During testing, a local model wrote "the top 10 raised £322m" when the real figure is £205.4m. The guard rejects output like that and retries.
- Title is capped at 60 characters and meta description kept to 120–160, falling back to a template if not.
- The intro is trimmed to two paragraphs.

## SEO

- **Server-side rendering:** full HTML (copy, stats and all 100 table rows) is in the initial response
- **Meta tags:** title, description, Open Graph and Twitter card per page
- **Canonical URL** on every blog page
- **Structured data (JSON-LD):** `Article`, `ItemList` for the ranking and `FAQPage`
- **`/sitemap.xml`:** generated on request, so new blogs appear automatically
- **`/robots.txt`:** blocks `/upload` and `/api/`, links the sitemap
- **Descriptive slugs** such as `/blog/top-100-uk-seed-fintech-companies`
- **Semantic, accessible HTML:** one `h1`, ordered headings, table `caption` and `scope`, description list for stats
- **Real 404s** for missing blogs
- Outbound company links use `rel="nofollow noopener"`; the upload page is `noindex`
- Homepage links to every blog so there are no orphan pages

## Setup

Requirements: Node 20+. Ollama is optional.

```bash
npm install
cp .env.example .env
```

Edit `.env`:
```
NUXT_GEMINI_API_KEY=your_key_from_aistudio.google.com   # optional
NUXT_LLM_MODELS=gemini-3.5-flash,gemini-flash-latest,ollama:llama3.2
NUXT_OLLAMA_URL=http://localhost:11434
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional local model (needs the Ollama app running):
```bash
ollama pull llama3.2
```

Run:
```bash
npm run dev
```
Open http://localhost:3000/upload

Without a Gemini key or Ollama, the app still works and uses template copy.

## Project structure

```
app/
  pages/index.vue            list of generated blogs
  pages/upload.vue           CSV upload form
  pages/blog/[slug].vue      blog template + SEO tags
  components/RankingTable.vue
  assets/main.css
server/
  api/generate.post.ts       upload → analyse → LLM → save
  api/blogs/index.get.ts     list blogs
  api/blogs/[slug].get.ts    one blog (404 if missing)
  routes/sitemap.xml.ts
  routes/robots.txt.ts
  utils/analyse.ts           CSV parsing, schema inference, stats
  utils/llm.ts               prompt, providers, retries, validation
data/blogs/                  generated blogs (JSON)
samples/                     test CSVs
```

## Tools used

- **Nuxt 4** for SSR pages and the API (Nitro server)
- **Papa Parse** for CSV parsing
- **Google Gemini API** (free tier) for copy generation
- **Ollama** with `llama3.2` as a free local fallback
- **unstorage** (Nitro storage, fs driver) to save blogs as JSON

## AI usage

AI coding tools were encouraged in the brief. I used Claude as a tutor and pair programmer: it explained concepts and proposed code, and I typed, ran, debugged and tested everything myself. Several design decisions came from problems I hit while testing (retired model names, Gemini 503s, a local model inventing numbers, missing sections), and each fix is described above.

## Known limitations and next steps

- **The fact-check guard catches invented numbers, not misused ones.** A real number attached to the wrong claim passes. For publishing at scale, I would add an editor review step before pages go live.
- Small local models sometimes make soft claims (e.g. "growing") despite the rules. Larger models (Gemini, or `llama3.1:8b`) follow instructions better.
- Gemini's free tier was often overloaded (503) during development, which is why the provider chain exists. The model order is config, so it can be changed without code changes.
- Blogs are stored as local JSON files. In production I would use a database or CMS, and add caching.
- Ideas: client-side table sorting, a preview/approve step before publishing, comparing datasets over time for trend insights, deploying to a host.
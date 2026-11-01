export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'file')
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Please upload a CSV file' })

  const industry =
    form?.find(f => f.name === 'industry')?.data.toString().trim() ||
    file.filename?.replace(/\.csv$/i, '') ||
    'Dataset'

  const analysis = analyseCsv(file.data.toString('utf-8'))

  // Put a constant "stage" (e.g. Seed) in the URL; it describes the dataset accurately
  const stage = Object.entries(analysis.constants).find(([k]) => /stage|round/i.test(k))?.[1] ?? ''
  const slug = slugify(`top-${analysis.rows.length}-uk-${stage}-${industry}-companies`)

  // S2 replaces this line with AI copy
  const blog = { slug, industry, createdAt: new Date().toISOString(), title: `Top UK ${industry} companies`, ...analysis }

  await useStorage('blogs').setItem(slug, blog)
  return { slug }
})
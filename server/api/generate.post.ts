export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'file')
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Please upload a CSV file' })

  const industry =
    form?.find(f => f.name === 'industry')?.data.toString().trim() ||
    file.filename?.replace(/\.csv$/i, '') ||
    'Dataset'

  const analysis = analyseCsv(file.data.toString('utf-8'))
  const slug = slugify(`top-${analysis.rows.length}-uk-${getStage(analysis)}-${industry}-companies`)

  const copy = await generateCopy(industry, analysis)
  const blog = { slug, industry, createdAt: new Date().toISOString(), ...copy, ...analysis }

  await useStorage('blogs').setItem(slug, blog)
  return { slug }
})
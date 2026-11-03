export default defineEventHandler(async (event) => {
  const { siteUrl } = useRuntimeConfig().public
  const storage = useStorage('blogs')
  const keys = await storage.getKeys()
  const blogs = (await Promise.all(keys.map(k => storage.getItem<any>(k)))).filter(Boolean)

  const urls = [
    `<url><loc>${siteUrl}/</loc></url>`,
    ...blogs.map(b => `<url><loc>${siteUrl}/blog/${b.slug}</loc><lastmod>${b.createdAt.slice(0, 10)}</lastmod></url>`),
  ]

  setHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
})
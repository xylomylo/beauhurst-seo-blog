export default defineEventHandler((event) => {
  const { siteUrl } = useRuntimeConfig().public
  setHeader(event, 'content-type', 'text/plain')
  return `User-agent: *
Disallow: /upload
Disallow: /api/
Sitemap: ${siteUrl}/sitemap.xml`
})
export default defineEventHandler(async () => {
  const storage = useStorage('blogs')
  const keys = await storage.getKeys()
  const blogs = await Promise.all(keys.map(k => storage.getItem<any>(k)))
  return blogs
    .filter(Boolean)
    .map((b: any) => ({ slug: b.slug, title: b.title, metaDescription: b.metaDescription, createdAt: b.createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
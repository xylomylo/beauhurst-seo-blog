export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const blog = await useStorage('blogs').getItem(slug)
  if (!blog) throw createError({ statusCode: 404, statusMessage: 'Blog not found' })
  return blog
})
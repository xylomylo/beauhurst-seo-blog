export default defineEventHandler(() => {
  return {
    a: toNumber('£1.2m'),
    b: toNumber('3,400'),
    c: toNumber('London'),
    d: slugify('Top 100 UK Fintech!'),
  }
})
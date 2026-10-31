// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: { head: { htmlAttrs: { lang: 'en-GB' } } },
  runtimeConfig: {
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    public: { siteUrl: 'http://localhost:3000' },
  },
  nitro: {
    storage: { blogs: { driver: 'fs', base: './data/blogs' } },
  },
})
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: { head: { htmlAttrs: { lang: 'en-GB' } } },
  runtimeConfig: {
    geminiApiKey: '',
    llmModels: 'gemini-3.5-flash,gemini-flash-latest,ollama:llama3.2',
    ollamaUrl: 'http://localhost:11434',
    public: { siteUrl: 'http://localhost:3000' },
  },
  nitro: {
    storage: { blogs: { driver: 'fs', base: './data/blogs' } },
  },
})
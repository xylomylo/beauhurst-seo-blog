<script setup lang="ts">
const file = ref<File | null>(null)
const industry = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!file.value) return
  loading.value = true
  error.value = ''
  const fd = new FormData()
  fd.append('file', file.value)
  fd.append('industry', industry.value)
  try {
    const { slug } = await $fetch<{ slug: string }>('/api/generate', { method: 'POST', body: fd })
    await navigateTo(`/blog/${slug}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Something went wrong'
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: 'Generate a blog', robots: 'noindex' })
</script>

<template>
  <main class="container">
    <h1>Generate a blog from a CSV</h1>
    <form @submit.prevent="submit">
      <label>
        Industry name
        <input v-model="industry" placeholder="e.g. Fintech" />
      </label>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv"
          required
          @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
      </label>
      <button :disabled="loading">{{ loading ? 'Generating…' : 'Generate blog' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>
</template>
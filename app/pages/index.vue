<script setup lang="ts">
const { data: blogs } = await useFetch('/api/blogs')

useSeoMeta({
  title: 'UK company rankings by industry',
  description: 'Data-led rankings of the UK’s most ambitious private companies, by industry.',
})
</script>

<template>
  <main class="container">
    <h1>Company rankings</h1>
    <p v-if="!blogs?.length">
      No blogs yet. <NuxtLink to="/upload">Generate one from a CSV</NuxtLink>.
    </p>
    <ul class="blog-list">
      <li v-for="b in blogs" :key="b.slug">
        <NuxtLink :to="`/blog/${b.slug}`"><h2>{{ b.title }}</h2></NuxtLink>
        <p>{{ b.metaDescription }}</p>
      </li>
    </ul>
  </main>
</template>
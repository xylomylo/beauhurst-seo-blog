<script setup lang="ts">
const route = useRoute()
const { data: blog } = await useFetch(`/api/blogs/${route.params.slug}`)
</script>

<template>
  <pre>{{ blog }}</pre>
</template>
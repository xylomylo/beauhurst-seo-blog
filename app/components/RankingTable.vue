<script setup lang="ts">
const props = defineProps<{
  columns: string[]
  rows: Record<string, string>[]
  nameCol: string
  caption: string
}>()

// Link company names to their website if the CSV has one
const linkCol = computed(() =>
  Object.keys(props.rows[0] ?? {}).find(k => /website|url|domain/i.test(k)),
)
</script>

<template>
  <div class="table-wrap">
    <table>
      <caption>{{ caption }}</caption>
      <thead>
        <tr>
          <th v-for="c in columns" :key="c" scope="col">{{ c }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.Rank">
          <td v-for="c in columns" :key="c">
            <a
              v-if="c === nameCol && linkCol && r[linkCol]"
              :href="r[linkCol]"
              target="_blank"
              rel="nofollow noopener"
            >{{ r[c] }}</a>
            <template v-else>{{ r[c] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
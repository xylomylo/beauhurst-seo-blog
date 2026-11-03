<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { data: blog } = await useFetch<any>(`/api/blogs/${route.params.slug}`)

if (!blog.value) {
  throw createError({ statusCode: 404, statusMessage: 'Blog not found', fatal: true })
}

const paragraphs = (t = '') => t.split(/\n\s*\n/).filter(Boolean)
const updated = new Date(blog.value.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const total = blog.value.rows.length
const url = `${config.public.siteUrl}/blog/${blog.value.slug}`

// ---- S4: SEO ----
useSeoMeta({
  title: blog.value.title,
  description: blog.value.metaDescription,
  ogTitle: blog.value.title,
  ogDescription: blog.value.metaDescription,
  ogType: 'article',
  ogUrl: url,
  twitterCard: 'summary',
})

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: blog.value.title,
            description: blog.value.metaDescription,
            datePublished: blog.value.createdAt,
            dateModified: blog.value.createdAt,
            author: { '@type': 'Organization', name: 'Beauhurst' },
            mainEntityOfPage: url,
          },
          {
            '@type': 'ItemList',
            name: blog.value.title,
            numberOfItems: total,
            itemListElement: blog.value.rows.map((r: any) => ({
              '@type': 'ListItem',
              position: Number(r.Rank),
              name: r[blog.value.nameCol],
            })),
          },
          ...(blog.value.faq?.length
            ? [{
                '@type': 'FAQPage',
                mainEntity: blog.value.faq.map((f: any) => ({
                  '@type': 'Question',
                  name: f.question,
                  acceptedAnswer: { '@type': 'Answer', text: f.answer },
                })),
              }]
            : []),
        ],
      }),
    },
  ],
})
</script>

<template>
  <article v-if="blog" class="container">
    <header>
      <p class="eyebrow">{{ blog.industry }} · Updated {{ updated }}</p>
      <h1>{{ blog.title }}</h1>
      <p v-for="p in paragraphs(blog.intro)" :key="p" class="lead">{{ p }}</p>
    </header>

    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading">Key statistics</h2>
      <dl class="stats">
        <div v-for="s in blog.stats" :key="s.label" class="stat">
          <dt>{{ s.label }}</dt>
          <dd>{{ s.value }}</dd>
        </div>
      </dl>
    </section>

    <section v-for="s in blog.sections" :key="s.heading">
      <h2>{{ s.heading }}</h2>
      <p v-for="p in paragraphs(s.body)" :key="p">{{ p }}</p>
    </section>

    <section v-if="blog.breakdowns?.length" aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading">Breakdown of the top {{ total }}</h2>
      <div class="breakdowns">
        <div v-for="b in blog.breakdowns" :key="b.column">
          <h3>By {{ b.column.toLowerCase() }}</h3>
          <ul class="bars">
            <li v-for="c in b.counts" :key="c.label">
              <span class="bar-label">{{ c.label }}</span>
              <span class="bar-track"><span class="bar" :style="{ width: `${(c.count / total) * 100}%` }" /></span>
              <span class="bar-count">{{ c.count }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section aria-labelledby="ranking-heading">
      <h2 id="ranking-heading">The full ranking</h2>
      <RankingTable
        :columns="blog.tableColumns"
        :rows="blog.rows"
        :name-col="blog.nameCol"
        :caption="blog.title"
      />
    </section>

    <section v-if="blog.faq?.length" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Frequently asked questions</h2>
      <details v-for="f in blog.faq" :key="f.question">
        <summary>{{ f.question }}</summary>
        <p>{{ f.answer }}</p>
      </details>
    </section>
  </article>
</template>
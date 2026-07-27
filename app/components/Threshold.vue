<script setup lang="ts">
// Threshold — el "umbral" entre grandes secciones (Vietnam→Camboya ahora; Parte I→Parte II en el
// futuro). Tratamiento de revista: aire generoso, filete con estrella dorada, sobrelínea a
// versalitas, título display grande y una bajada (dek) evocadora en cursiva. Reutilizable por props.
//
// Título y dek son inline y viven en <h2>/<p>: van con `inlineMd` (app/utils/inline-md.ts), NO con
// <MDC unwrap="p">, que envolvía el texto en un <div> — inválido dentro de un <p> y causa del
// mismatch de hidratación de cada umbral.
defineProps<{
  id?: string // ancla opcional para que el índice flotante salte a este umbral
  overline: string
  title: string // Markdown-inline: la *cursiva* sale en cinabrio
  dek?: string
}>()
</script>

<template>
  <section
    :id="id"
    class="threshold"
  >
    <div
      class="threshold-ornament"
      aria-hidden="true"
    >
      <span class="threshold-line" />
      <span class="threshold-mark">✦</span>
      <span class="threshold-line" />
    </div>
    <div class="threshold-overline">
      {{ overline }}
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <h2
      class="threshold-title"
      v-html="inlineMd(title)"
    />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p
      v-if="dek"
      class="threshold-dek"
      v-html="inlineMd(dek)"
    />
  </section>
</template>

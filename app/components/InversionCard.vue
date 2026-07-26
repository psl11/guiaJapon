<script setup lang="ts">
// InversionCard — la ficha de decisión de dinero (Parte I). Veredicto con badge de color
// (imprescindible=oro · merece=índigo · solo-si=oro suave · prescindible=cinabrio) + el desglose
// cuesta/qué compra/la alternativa. La regla de oro: algunas SALEN "prescindible", y por eso vale.
// La prosa se targetea sobre `.inversion` (ancestro estable), robusto ante el class-loss de MDC.
import type { Inversion } from '~~/shared/schemas'

defineProps<{ inversion: Inversion }>()

// Título inline por v-html (como DiaCard/FichaCard): NO usar <MDC> aquí — mete un <p> de bloque
// dentro del <h2> (HTML inválido). El render inline es idéntico en SSR y cliente y solo cubre el
// subset que usan los títulos (*cursiva* → cinabrio, **fuerte**, `code`). [TODO: extraer este
// helper a app/utils/ y compartirlo con DiaCard/FichaCard — ver REVISION.md.]
function inlineTitle(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
</script>

<template>
  <section
    :id="inversion.slug"
    class="inversion"
    :data-verdict="inversion.verdict"
  >
    <div class="inversion-head">
      <div class="inversion-heading">
        <div class="inversion-kicker">
          {{ inversion.kicker }}
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <h2 v-html="inlineTitle(inversion.title)" />
      </div>
      <span class="inversion-badge">{{ inversion.verdictLabel }}</span>
    </div>

    <div class="inversion-lede">
      <MDC :value="inversion.lede" />
    </div>

    <dl class="inversion-ledger">
      <div
        v-for="(row, i) in inversion.ledger"
        :key="i"
        class="inversion-row"
      >
        <dt>{{ row.label }}</dt>
        <dd>
          <MDC :value="row.body" />
        </dd>
      </div>
    </dl>

    <div
      v-if="inversion.curiosidades?.length"
      class="curiosidades"
    >
      <div class="curiosidades-label">
        Curiosidades
      </div>
      <ul>
        <li
          v-for="(c, i) in inversion.curiosidades"
          :key="i"
        >
          <MDC :value="c" />
        </li>
      </ul>
    </div>
  </section>
</template>

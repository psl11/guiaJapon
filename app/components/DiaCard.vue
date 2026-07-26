<script setup lang="ts">
// DiaCard — archetipo del itinerario (Parte I), modelo "bloques como tarjetas".
// El eje NO es la agenda por horas sino los BLOQUES del día (amanecer/mañana/mediodía/tarde/noche),
// cada uno una tarjeta con su "ventana óptima": el porqué de ese momento (luz/gentío/calor). Esa
// caja dorada es el alma del plan — la hora es referencia, no orden.
//
// Hidratación: NADA de <MDC unwrap="p"> (evita el fragmento que desincroniza y hace perder la clase
// al hermano). El título del día usa un render inline propio vía v-html (idéntico SSR/cliente); la
// prosa (dek, cuerpo, ventana) va con <MDC :value> SIN unwrap dentro de su contenedor.
import type { Dia } from '~~/shared/schemas'

defineProps<{ dia: Dia }>()

// Markdown inline de confianza para el título (*cursiva*, **fuerte**, `code`) — sin fragmento de
// componente, así que hidrata idéntico. No soporta enlaces (los títulos no los llevan).
function inlineTitle(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
</script>

<template>
  <article
    :id="dia.slug"
    class="dia"
  >
    <div class="dia-eyebrow">
      {{ dia.eyebrow }}
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <h2
      class="dia-title"
      v-html="inlineTitle(dia.title)"
    />
    <div
      v-if="dia.dek"
      class="dia-dek"
    >
      <MDC :value="dia.dek" />
    </div>

    <div class="dia-blocks">
      <section
        v-for="(b, i) in dia.blocks"
        :key="i"
        class="dia-block"
        :class="{ 'dia-block--rest': b.dim }"
      >
        <header class="dia-bhead">
          <span class="dia-bname">{{ b.block }}</span>
          <span
            v-if="b.time"
            class="dia-btime"
          >{{ b.time }}</span>
        </header>
        <div class="dia-bbody">
          <h3 class="dia-bact">
            {{ b.title }}
          </h3>
          <div class="dia-btext">
            <MDC :value="b.body" />
          </div>
          <div
            v-if="b.window"
            class="dia-window"
          >
            <div class="dia-wlabel">
              {{ b.window.label }}
            </div>
            <div class="dia-wbody">
              <MDC :value="b.window.body" />
            </div>
          </div>
        </div>
      </section>
    </div>
  </article>
</template>

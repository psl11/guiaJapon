<script setup lang="ts">
// RecomendadoCard — un hallazgo que trae alguien del grupo y que NO es un restaurante: un mercado
// con fecha fija, un taller donde graban palillos, un truco de equipaje. Los locales de comer no
// pasan por aquí: viven en `comidas/` con su `fuente`, y esta sección los enlaza sin duplicarlos.
//
// Lo que distingue esta tarjeta de las demás es el pie: SIEMPRE lleva el enlace al post original.
// Ese es el trato de la sección — cada recomendación se puede contrastar en su fuente antes de
// meterla en el día.
//
// Campos cortos por `inlineMd` y <MDC> solo dentro de su propio <div> (trampa 3.8 de CLAUDE.md).
import type { Recomendado } from '~~/shared/schemas'

const props = defineProps<{ reco: Recomendado, knownAnchors?: Set<string> }>()

// Mismo contrato que FichaCard: un chip enlaza sólo si su ancla EXISTE en la página; si no, se
// pinta como etiqueta. Así un día renumerado no deja enlaces muertos, sólo etiquetas.
const chipHref = (ref: string) => (props.knownAnchors?.has(ref.replace(/^#/, '')) ? ref : undefined)

// Mapa de búsqueda, no coordenadas inventadas (regla 4.5). Solo si la ficha no trae ya un enlace.
const mapsUrl = computed(() =>
  'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent([props.reco.title, props.reco.area, props.reco.city].filter(Boolean).join(' ')))

</script>

<template>
  <article
    :id="reco.slug"
    class="recomendado"
  >
    <div class="comida-head">
      <div class="comida-headings">
        <h3 class="comida-title">
          {{ reco.title }}
        </h3>
        <div class="comida-sub">
          <span class="comida-tipo"><span v-html="inlineMd(reco.tipo)" /></span>
          <template v-if="reco.area || reco.city">
            <span class="comida-dot">·</span>{{ [reco.area, reco.city].filter(Boolean).join(' · ') }}
          </template>
        </div>
      </div>
      <span
        class="cchip"
        :class="`fuente--${reco.fuente}`"
      >{{ reco.fuente === 'alba' ? 'Alba' : 'Pablo' }}</span>
    </div>

    <div
      v-if="reco.cuando"
      class="comida-cuando"
    >
      <span aria-hidden="true">📍</span> {{ reco.cuando }}
    </div>

    <!-- El aviso va en rojo y aparte del cuerpo a propósito: es la condición que puede tumbar el
         plan (que llueva, que cierre ese día), y en un párrafo se lee tarde. -->
    <p
      v-if="reco.aviso"
      class="reco-aviso"
    >
      <span aria-hidden="true">⚠</span> <span v-html="inlineMd(reco.aviso)" />
    </p>

    <div class="comida-body">
      <MDC :value="reco.body" />
    </div>

    <div class="comida-foot">
      <a
        class="comida-link comida-fuente"
        :href="reco.url"
        target="_blank"
        rel="noopener noreferrer"
      >▶ El post de {{ reco.fuente === 'alba' ? 'Alba' : 'Pablo' }} ↗</a>
      <a
        v-if="reco.link"
        class="comida-link"
        :href="reco.link.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ reco.link.label }} →</a>
      <a
        v-else-if="reco.kind !== 'truco'"
        class="comida-link comida-maps"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
      >◎ Google Maps ↗</a>
      <component
        :is="chipHref(reco.dia.ref) ? 'a' : 'span'"
        v-if="reco.dia"
        class="chip"
        :href="chipHref(reco.dia.ref)"
      >{{ reco.dia.label }}</component>
      <component
        :is="chipHref(l.ref) ? 'a' : 'span'"
        v-for="l in reco.seenIn"
        :key="l.ref"
        class="chip"
        :href="chipHref(l.ref)"
      >{{ l.label }}</component>
    </div>
  </article>
</template>

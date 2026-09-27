<script setup lang="ts">
// ComidaCard — una entrada del directorio gastronómico (restaurante/café/puesto/bar). Se mira de un
// vistazo: sello (Michelin/50 Best…) + tipo · zona · encaje logístico + chips (quién lo trae · precio · reserva ·
// colas) + «qué pedir» destacado + el porqué en <MDC>. Los campos cortos van con `inlineMd`, no con
// <MDC unwrap>, para que hidrate limpio (ver trampa 3.8 de CLAUDE.md).
// Los cruces (`seenIn`) van como enlaces internos (los resuelve el plugin anchor-nav).
import type { Comida } from '~~/shared/schemas'
import { TRIP_INDEX } from '~/composables/useTripIndex'

const props = defineProps<{ comida: Comida }>()

// En qué días del plan sale este local (lo calcula el índice a partir de `comer` de los bloques).
const idx = inject(TRIP_INDEX, null)
const enDias = computed(() => idx?.comidaEnDias.value.get(props.comida.slug) ?? [])

// Enlace de mapa auto-generado (búsqueda, no URL de sitio inventada): nombre + zona + ciudad.
const mapsUrl = computed(() =>
  'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent([props.comida.title, props.comida.area, props.comida.city].filter(Boolean).join(' ')))
</script>

<template>
  <article
    :id="comida.slug"
    class="comida"
  >
    <div class="comida-head">
      <div class="comida-headings">
        <h3 class="comida-title">
          {{ comida.title }}
        </h3>
        <div class="comida-sub">
          <span class="comida-tipo"><span v-html="inlineMd(comida.tipo)" /></span>
          <template v-if="comida.area">
            <span class="comida-dot">·</span>{{ comida.area }}
          </template>
        </div>
      </div>
      <span
        v-if="comida.badge"
        class="comida-badge"
      >{{ comida.badge }}</span>
    </div>

    <div
      v-if="comida.cuando"
      class="comida-cuando"
    >
      <span aria-hidden="true">📍</span> {{ comida.cuando }}
    </div>

    <div
      v-if="comida.precio || comida.reserva || comida.colas || comida.fuente"
      class="comida-chips"
    >
      <span
        v-if="comida.fuente"
        class="cchip"
        :class="`fuente--${comida.fuente}`"
      >Recomienda {{ comida.fuente === 'alba' ? 'Alba' : 'Pablo' }}</span>
      <span
        v-if="comida.precio"
        class="cchip"
      ><span v-html="inlineMd(comida.precio)" /></span>
      <span
        v-if="comida.reserva"
        class="cchip"
      >Reserva: {{ comida.reserva }}</span>
      <span
        v-if="comida.colas"
        class="cchip"
      >Colas: <span v-html="inlineMd(comida.colas)" /></span>
    </div>

    <div
      v-if="comida.quePedir"
      class="comida-pedir"
    >
      <span class="comida-pedir-label">Qué pedir</span>
      <MDC :value="comida.quePedir" />
    </div>

    <div class="comida-body">
      <MDC :value="comida.body" />
    </div>

    <div class="comida-foot">
      <a
        class="comida-link comida-maps"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
      >◎ Google Maps ↗</a>
      <a
        v-if="comida.link"
        class="comida-link"
        :href="comida.link.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ comida.link.label }} →</a>
      <a
        v-for="l in enDias"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >En el plan: {{ l.label }}</a>
      <a
        v-for="l in comida.seenIn"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >{{ l.label }}</a>
    </div>
  </article>
</template>

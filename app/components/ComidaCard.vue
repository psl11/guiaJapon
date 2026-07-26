<script setup lang="ts">
// ComidaCard — una entrada del directorio gastronómico (restaurante/café/puesto/bar). Se mira de un
// vistazo: sello (Michelin/50 Best…) + tipo · zona · encaje logístico + chips (precio · reserva ·
// colas · VEG coloreado por estatus) + «qué pedir» destacado + el porqué en <MDC>. El chip VEG es
// obligatorio (la novia es vegetariana); su color sale del propio texto. Sin <MDC unwrap> → hidrata
// limpio. Los cruces (`seenIn`) van como enlaces internos (los resuelve el plugin anchor-nav).
import type { Comida } from '~~/shared/schemas'

const props = defineProps<{ comida: Comida }>()

// Estatus veg para el color del chip: verde = apto/100%, cinabrio = no apto, ámbar = opciones/limitado.
const vegClass = computed(() => {
  const v = props.comida.veg.toLowerCase()
  if (/no apto|no veg|no vegetarian/.test(v)) return 'veg--no'
  if (/(100\s*%|vegano|vegana|excelente|apto)/.test(v) && !/limitad|no apto/.test(v)) return 'veg--si'
  return 'veg--ok'
})

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
          <span class="comida-tipo">{{ comida.tipo }}</span>
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
      v-if="comida.precio || comida.reserva || comida.colas"
      class="comida-chips"
    >
      <span
        v-if="comida.precio"
        class="cchip"
      >{{ comida.precio }}</span>
      <span
        v-if="comida.reserva"
        class="cchip"
      >Reserva: {{ comida.reserva }}</span>
      <span
        v-if="comida.colas"
        class="cchip"
      >Colas: {{ comida.colas }}</span>
    </div>

    <div
      class="comida-veg"
      :class="vegClass"
    >
      <span class="comida-veg-tag">Veg</span> {{ comida.veg }}
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
        v-for="l in comida.seenIn"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >{{ l.label }}</a>
    </div>
  </article>
</template>

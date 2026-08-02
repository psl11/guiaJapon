<script setup lang="ts">
// HotelCard — una entrada del directorio de alojamiento (sección «Dónde dormir»). Mismo archetipo
// de vistazo que ComidaCard: nombre + tipo · zona + chip de estado, la línea de estaciones (que es
// LO que decide un hotel en Japón), los chips de noches/habitaciones/precio/nota y el porqué en
// <MDC>. Los campos cortos van con `inlineMd`, NUNCA con <MDC unwrap> (trampa 3.8 de CLAUDE.md:
// un <div> de bloque dentro de un <span> rompe la hidratación en silencio).
//
// `deadline` se pinta aparte y en oro porque es el único dato que CADUCA: la fecha en que una
// reserva con cancelación gratuita deja de ser gratis.
import type { Hotel } from '~~/shared/schemas'

const props = defineProps<{ hotel: Hotel }>()

const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  candidato: 'Candidato',
  descartado: 'Descartado',
}

// Enlace de mapa auto-generado por BÚSQUEDA (nombre + zona), nunca una URL de sitio inventada
// ni coordenadas — regla 4.5 de CLAUDE.md.
const mapsUrl = computed(() =>
  'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent([props.hotel.title, props.hotel.area].filter(Boolean).join(' ')))

// La línea resumen de estaciones se DERIVA de `estaciones`, que es también lo que dibuja StopMap:
// una sola fuente de verdad, así que el diagrama y la tarjeta no pueden contradecirse.
const estacionLinea = computed(() => (props.hotel.estaciones ?? [])
  .map(e => `${e.nombre}${e.lineas ? ` (${e.lineas})` : ''} ${e.minutos} min`)
  .join(' · '))
</script>

<template>
  <article
    :id="hotel.slug"
    class="hotel"
    :data-status="hotel.status"
  >
    <div class="hotel-head">
      <div class="hotel-headings">
        <h3 class="hotel-title">
          {{ hotel.title }}
        </h3>
        <div class="hotel-sub">
          <span class="hotel-tipo"><span v-html="inlineMd(hotel.tipo)" /></span>
          <template v-if="hotel.area">
            <span class="hotel-dot">·</span>{{ hotel.area }}
          </template>
        </div>
      </div>
      <span class="hotel-status">{{ STATUS_LABEL[hotel.status] }}</span>
    </div>

    <CardPhoto
      v-if="hotel.image"
      :image="hotel.image"
    />

    <div
      v-if="estacionLinea"
      class="hotel-estacion"
    >
      <span aria-hidden="true">◉</span> {{ estacionLinea }}
    </div>

    <div
      v-if="hotel.noches || hotel.habitaciones || hotel.precio || hotel.rating"
      class="hotel-chips"
    >
      <span
        v-if="hotel.noches"
        class="cchip"
      >{{ hotel.noches }}</span>
      <span
        v-if="hotel.habitaciones"
        class="cchip"
      >{{ hotel.habitaciones }}</span>
      <span
        v-if="hotel.precio"
        class="cchip"
      ><span v-html="inlineMd(hotel.precio)" /></span>
      <span
        v-if="hotel.rating"
        class="cchip"
      >{{ hotel.rating }}</span>
    </div>

    <div
      v-if="hotel.deadline"
      class="hotel-deadline"
    >
      <span aria-hidden="true">⏳</span> {{ hotel.deadline }}
    </div>

    <div
      v-if="hotel.nota"
      class="hotel-nota"
    >
      {{ hotel.nota }}
    </div>

    <div class="hotel-body">
      <MDC :value="hotel.body" />
    </div>

    <div class="hotel-foot">
      <a
        class="hotel-link hotel-maps"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
      >◎ Google Maps ↗</a>
      <a
        v-if="hotel.link"
        class="hotel-link"
        :href="hotel.link.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ hotel.link.label }} →</a>
      <a
        v-for="l in hotel.seenIn"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >{{ l.label }}</a>
    </div>
  </article>
</template>

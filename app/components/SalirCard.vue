<script setup lang="ts">
// SalirCard — una entrada de «Salir · música y librerías» (un club de jazz o una librería). No es
// gastronomía: no lleva chip veg. Icono por `kind`, tipo · zona · encaje logístico, el porqué en
// <MDC>, y enlaces a Google Maps (auto) + web. Los cruces (`seenIn`) son enlaces internos.
import type { Salir } from '~~/shared/schemas'

const props = defineProps<{ salir: Salir }>()

const ICON: Record<string, string> = { jazz: '🎷', libreria: '📚' }
const mapsUrl = computed(() =>
  'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent([props.salir.title, props.salir.area, props.salir.city].filter(Boolean).join(' ')))
</script>

<template>
  <article
    :id="salir.slug"
    class="comida salir"
  >
    <div class="comida-head">
      <div class="comida-headings">
        <h3 class="comida-title">
          <span aria-hidden="true">{{ ICON[salir.kind] }}</span> {{ salir.title }}
        </h3>
        <div class="comida-sub">
          <span class="comida-tipo">{{ salir.tipo }}</span>
          <template v-if="salir.area">
            <span class="comida-dot">·</span>{{ salir.area }}
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="salir.cuando"
      class="comida-cuando"
    >
      <span aria-hidden="true">📍</span> {{ salir.cuando }}
    </div>

    <div
      v-if="salir.precio || salir.reserva"
      class="comida-chips"
    >
      <span
        v-if="salir.precio"
        class="cchip"
      >{{ salir.precio }}</span>
      <span
        v-if="salir.reserva"
        class="cchip"
      >Reserva: {{ salir.reserva }}</span>
    </div>

    <div class="comida-body">
      <MDC :value="salir.body" />
    </div>

    <div class="comida-foot">
      <a
        class="comida-link comida-maps"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
      >◎ Google Maps ↗</a>
      <a
        v-if="salir.link"
        class="comida-link"
        :href="salir.link.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ salir.link.label }} →</a>
      <a
        v-for="l in salir.seenIn"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >{{ l.label }}</a>
    </div>
  </article>
</template>

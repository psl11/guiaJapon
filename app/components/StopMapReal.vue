<script setup lang="ts">
// StopMapReal — el mapa REAL de una parada: cartografía de OpenStreetMap horneada en build
// (scripts/build-stopmap.mjs) como una imagen WebP, con los marcadores en una capa HTML encima.
//
// Es una IMAGEN, no un widget, y esa es toda la gracia: entra en el precache como cualquier foto y
// funciona offline. Un Leaflet o un Google Maps pediría tiles por red al hacer pan y zoom, y esos
// tiles no se pueden precachear porque no se pueden enumerar de antemano → adiós al offline, que en
// esta guía tiene puerta en CI. El precio es que no hay pan ni zoom, y se acepta.
//
// Los marcadores van en % sobre la imagen (los calcula el script proyectando lat/lon en Web
// Mercator), así que escalan solos: la imagen es responsive y los pines la siguen.
//
// La atribución «© OpenStreetMap contributors» es OBLIGATORIA por la licencia ODbL. No la quites.
import { stopMaps } from './stopMapsGeo.js'

const props = defineProps<{ anchor: string, city: string }>()

const base = useRuntimeConfig().app.baseURL
const geo = computed(() => (stopMaps as Record<string, {
  image: string
  w: number
  h: number
  hoteles: { slug: string, title: string, status: string, x: number, y: number }[]
  estaciones: { nombre: string, x: number, y: number }[]
  puntos?: { nombre: string, tipo: string, x: number, y: number }[]
}>)[props.anchor])
</script>

<template>
  <figure
    v-if="geo"
    class="realmap"
  >
    <div
      class="realmap-canvas"
      :style="{ aspectRatio: `${geo.w} / ${geo.h}` }"
    >
      <img
        :src="base + geo.image"
        :alt="`Mapa de ${city} con la posición de los alojamientos y sus estaciones.`"
        loading="lazy"
        decoding="async"
      >

      <span
        v-for="e in geo.estaciones"
        :key="e.nombre"
        class="realmap-station"
        :style="{ left: e.x + '%', top: e.y + '%' }"
      >
        <i aria-hidden="true" />
        <b>{{ e.nombre }}</b>
      </span>

      <span
        v-for="p in geo.puntos"
        :key="p.nombre"
        class="realmap-poi"
        :style="{ left: p.x + '%', top: p.y + '%' }"
        :title="p.tipo"
      >
        <i aria-hidden="true" />
        <b>{{ p.nombre }}</b>
      </span>

      <a
        v-for="(h, i) in geo.hoteles"
        :key="h.slug"
        class="realmap-pin"
        :data-status="h.status"
        :style="{ left: h.x + '%', top: h.y + '%' }"
        :href="'#' + h.slug"
        :aria-label="`Ir a la ficha de ${h.title}`"
      >{{ i + 1 }}</a>
    </div>

    <figcaption class="realmap-cap">
      Cartografía <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener nofollow"
      >© OpenStreetMap contributors</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.realmap { margin: 1.4rem 0 0; }
.realmap-canvas {
  position: relative;
  max-width: 420px;
  margin: 0 auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.realmap-canvas img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* El estilo por defecto de OSM es muy saturado al lado de la paleta kōyō; se calma un punto para
     que el mapa acompañe a la página en vez de gritar por encima de ella. */
  filter: saturate(0.62) contrast(1.02);
}

/* Estación: punto índigo hueco + rótulo debajo, con halo para que se lea sobre el mapa. */
.realmap-station {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
}
.realmap-station i {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--bg-elev); border: 2px solid var(--indigo);
}
.realmap-station b {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.56rem; font-weight: 700; letter-spacing: 0.04em;
  color: var(--indigo); white-space: nowrap;
  /* halo por sombra, no por fondo: no tapa el mapa */
  text-shadow: 0 0 3px var(--bg-elev), 0 0 3px var(--bg-elev), 0 0 5px var(--bg-elev);
}

/* Punto de interés: rombo en cinabrio. Distinto de la estación (círculo índigo) a propósito — son
   dos cosas que se leen distinto: la estación es logística, el punto es plan. */
.realmap-poi {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
}
.realmap-poi i {
  width: 8px; height: 8px;
  background: var(--accent);
  border: 1.5px solid #fff;
  transform: rotate(45deg);
  box-shadow: 0 1px 3px rgb(0 0 0 / 32%);
}
.realmap-poi b {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.54rem; font-weight: 700; letter-spacing: 0.03em;
  color: var(--accent); white-space: nowrap;
  text-shadow: 0 0 3px var(--bg-elev), 0 0 3px var(--bg-elev), 0 0 5px var(--bg-elev);
}

/* Pin de hotel: círculo numerado, con el mismo semáforo de estado que la tarjeta. */
.realmap-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 1.6rem; height: 1.6rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--gold); color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 38%);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.72rem; font-weight: 700;
  text-decoration: none;
}
.realmap-pin[data-status="confirmado"] { background: var(--indigo); }
.realmap-pin[data-status="descartado"] { background: var(--ink-faint); }
.realmap-pin:hover, .realmap-pin:focus-visible {
  transform: translate(-50%, -50%) scale(1.16);
  box-shadow: 0 2px 9px rgb(0 0 0 / 46%);
}

.realmap-cap {
  margin-top: 0.45rem;
  text-align: center;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem;
  color: var(--ink-faint);
}
.realmap-cap a { color: var(--ink-faint); }
</style>

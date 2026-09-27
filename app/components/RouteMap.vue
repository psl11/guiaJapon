<script setup lang="ts">
// RouteMap — un paseo a pie dentro de un bloque del día: cartografía de OSM horneada
// (scripts/build-routemap.mjs) con el recorrido en puntitos encima y un enlace a Google Maps para
// reproducirlo con indicaciones. Mismo planteamiento que StopMapReal: imagen, no widget.
//
// El trazado va en un SVG con viewBox en píxeles de la imagen original. Como el contenedor tiene la
// misma proporción, escala uniforme y los puntitos siguen a las calles a cualquier ancho.
//
// El enlace de Maps usa las coordenadas y no los nombres a propósito: con el nombre, Google resuelve
// «Chuo-dori» en Ginza, a 3 km, que es justo el error que este mapa viene a evitar.
// La atribución «© OpenStreetMap contributors» es OBLIGATORIA por la licencia ODbL.
import { routeMaps } from './routeMapsGeo.js'

type Punto = { nombre: string, lat: number, lon: number }
const props = defineProps<{ ruta: { slug: string, desde: Punto, hasta: Punto } }>()

const base = useRuntimeConfig().app.baseURL
const geo = computed(() => (routeMaps as Record<string, {
  image: string
  w: number
  h: number
  metros: number
  minutos: number
  path: [number, number][]
  desde: [number, number]
  hasta: [number, number]
}>)[props.ruta.slug])

const points = computed(() => geo.value?.path.map(p => p.join(',')).join(' '))
const pct = (p: [number, number]) => ({
  left: (p[0] / geo.value!.w) * 100 + '%',
  top: (p[1] / geo.value!.h) * 100 + '%',
})
const mapsUrl = computed(() => {
  const { desde, hasta } = props.ruta
  return 'https://www.google.com/maps/dir/?api=1'
    + `&origin=${desde.lat},${desde.lon}&destination=${hasta.lat},${hasta.lon}&travelmode=walking`
})
</script>

<template>
  <figure
    v-if="geo"
    class="routemap"
  >
    <div
      class="routemap-canvas"
      :style="{ aspectRatio: `${geo.w} / ${geo.h}` }"
    >
      <img
        :src="base + geo.image"
        :alt="`Mapa del paseo a pie de ${ruta.desde.nombre} a ${ruta.hasta.nombre}.`"
        loading="lazy"
        decoding="async"
      >
      <svg
        :viewBox="`0 0 ${geo.w} ${geo.h}`"
        aria-hidden="true"
      >
        <polyline
          class="routemap-halo"
          :points="points"
        />
        <polyline
          class="routemap-dots"
          :points="points"
        />
      </svg>
      <span
        class="routemap-pt routemap-pt--from"
        :style="pct(geo.desde)"
      ><i /><b>{{ ruta.desde.nombre }}</b></span>
      <span
        class="routemap-pt routemap-pt--to"
        :style="pct(geo.hasta)"
      ><i /><b>{{ ruta.hasta.nombre }}</b></span>
    </div>

    <figcaption class="routemap-cap">
      <span>{{ geo.metros }} m · {{ geo.minutos }} min a pie</span>
      <a
        class="routemap-link"
        :href="mapsUrl"
        target="_blank"
        rel="noopener"
      >Abrir la ruta en Google Maps</a>
      <small>Cartografía <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener nofollow"
      >© OpenStreetMap contributors</a></small>
    </figcaption>
  </figure>
</template>

<style scoped>
.routemap { margin: 1rem 0 0; }
.routemap-canvas {
  position: relative;
  max-width: 420px;
  margin: 0 auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.routemap-canvas img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.62) contrast(1.02);
}
.routemap-canvas svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.routemap-canvas polyline { fill: none; stroke-linecap: round; stroke-linejoin: round; }
/* Halo blanco continuo debajo para que los puntos se lean sobre cualquier calle. */
.routemap-halo { stroke: #fff; stroke-width: 16; opacity: 0.75; }
/* Dash de longitud 0 + extremo redondo = un punto por cada hueco. */
.routemap-dots { stroke: var(--accent); stroke-width: 10; stroke-dasharray: 0 18; }

.routemap-pt {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
}
.routemap-pt i {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 38%);
}
.routemap-pt--from i { background: var(--indigo); }
.routemap-pt--to i { background: var(--accent); }
.routemap-pt b {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.03em;
  color: var(--ink); white-space: nowrap;
  text-shadow: 0 0 3px var(--bg-elev), 0 0 3px var(--bg-elev), 0 0 5px var(--bg-elev);
}

.routemap-cap {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.68rem;
  color: var(--ink-soft, var(--ink-faint));
}
.routemap-link { color: var(--indigo); font-weight: 700; }
.routemap-cap small { font-size: 0.6rem; color: var(--ink-faint); }
.routemap-cap small a { color: var(--ink-faint); }
</style>

<script setup lang="ts">
// DayMap — el día de un vistazo: cartografía de OSM horneada (scripts/build-routemap.mjs) con las
// paradas numeradas, las zonas en círculos y los tramos encima; debajo, la leyenda en orden con la
// hora. Sirve para RECORDAR el día sin releerlo. Mismo planteamiento que StopMapReal: imagen, no
// widget.
//
// Los tramos a pie van en puntitos (trazado real por calles); metro y tren en recta discontinua,
// porque lo que importa es «de aquí a allí en metro», no por dónde va el túnel.
// La atribución «© OpenStreetMap contributors» es OBLIGATORIA por la licencia ODbL.
import { dayMaps } from './routeMapsGeo.js'
import type { Dia } from '~~/shared/schemas'

const props = defineProps<{ mapa: NonNullable<Dia['mapa']> }>()

type XY = [number, number]
const base = useRuntimeConfig().app.baseURL
const geo = computed(() => (dayMaps as Record<string, {
  image: string
  w: number
  h: number
  paradas: XY[]
  tramos: { modo: 'a-pie' | 'metro' | 'tren' | 'bus', path: XY[] }[]
  zonas: { nombre: string, c: XY, r: number }[]
  extras?: { key: string, tipo: 'ver' | 'comer', nombre: string, letra: string, xy: XY }[]
}>)[props.mapa.slug])
const extrasVer = computed(() => geo.value?.extras?.filter(e => e.tipo === 'ver') ?? [])
const extrasComer = computed(() => geo.value?.extras?.filter(e => e.tipo === 'comer') ?? [])

const pts = (path: XY[]) => path.map(p => p.join(',')).join(' ')
const MODO = { 'a-pie': 'a pie', 'metro': 'metro', 'tren': 'tren', 'bus': 'bus' } as const
// La primera parada es el punto de salida (el hotel): va sin número, con una «S». Si el día acaba
// donde empezó, la última también es la «S» y no se pinta encima de ella.
const vuelveAlInicio = computed(() => {
  const p = props.mapa.paradas, a = p[0]!, z = p[p.length - 1]!
  return p.length > 2 && a.lat === z.lat && a.lon === z.lon
})
const etiqueta = (i: number) => (i === 0 || (vuelveAlInicio.value && i === props.mapa.paradas.length - 1) ? 'S' : String(i))
const pintarParada = (i: number) => !(vuelveAlInicio.value && i === props.mapa.paradas.length - 1)
</script>

<template>
  <figure
    v-if="geo"
    class="daymap"
  >
    <figcaption class="daymap-title">
      El día de un vistazo
    </figcaption>
    <div
      class="daymap-canvas"
      :style="{ aspectRatio: `${geo.w} / ${geo.h}` }"
    >
      <img
        :src="base + geo.image"
        alt="Mapa del recorrido del día con las paradas numeradas."
        loading="lazy"
        decoding="async"
      >
      <svg
        :viewBox="`0 0 ${geo.w} ${geo.h}`"
        aria-hidden="true"
      >
        <g
          v-for="z in geo.zonas"
          :key="z.nombre"
        >
          <circle
            class="daymap-zone"
            :cx="z.c[0]"
            :cy="z.c[1]"
            :r="z.r"
          />
          <text
            class="daymap-zlabel"
            :x="z.c[0]"
            :y="z.c[1] - z.r + 18"
          >{{ z.nombre }}</text>
        </g>
        <template
          v-for="(t, i) in geo.tramos"
          :key="i"
        >
          <polyline
            class="daymap-halo"
            :points="pts(t.path)"
          />
          <polyline
            :class="t.modo === 'a-pie' ? 'daymap-walk' : 'daymap-ride'"
            :points="pts(t.path)"
          />
        </template>
        <g
          v-for="e in geo.extras"
          :key="e.key"
          class="daymap-extra"
          :class="'daymap-extra--' + e.tipo"
        >
          <rect
            v-if="e.tipo === 'ver'"
            :x="e.xy[0] - 19"
            :y="e.xy[1] - 19"
            width="38"
            height="38"
            rx="6"
          />
          <circle
            v-else
            :cx="e.xy[0]"
            :cy="e.xy[1]"
            r="20"
          />
          <text
            :x="e.xy[0]"
            :y="e.xy[1]"
          >{{ e.letra }}</text>
        </g>
        <g
          v-for="(p, i) in geo.paradas"
          :key="i"
          class="daymap-stop"
          :class="{ 'daymap-stop--start': i === 0 }"
          :display="pintarParada(i) ? undefined : 'none'"
        >
          <circle
            :cx="p[0]"
            :cy="p[1]"
            r="30"
          />
          <text
            :x="p[0]"
            :y="p[1]"
          >{{ etiqueta(i) }}</text>
        </g>
      </svg>
    </div>

    <ol class="daymap-legend">
      <li
        v-for="(p, i) in mapa.paradas"
        :key="i"
      >
        <span
          class="daymap-num"
          :class="{ 'daymap-num--start': etiqueta(i) === 'S' }"
        >{{ etiqueta(i) }}</span>
        <span class="daymap-name">{{ p.nombre }}</span>
        <span
          v-if="p.hora"
          class="daymap-meta"
        >{{ p.hora }}</span>
        <span
          v-if="i > 0"
          class="daymap-meta daymap-mode"
        >{{ MODO[p.llegada ?? 'a-pie'] }}</span>
      </li>
    </ol>
    <div
      v-if="geo.extras?.length"
      class="daymap-extras"
    >
      <p v-if="extrasVer.length">
        <span class="daymap-xlabel">Qué ver</span>
        <span
          v-for="e in extrasVer"
          :key="e.key"
          class="daymap-x"
        ><b class="daymap-xl daymap-xl--ver">{{ e.letra }}</b> {{ e.nombre }}</span>
      </p>
      <p v-if="extrasComer.length">
        <span class="daymap-xlabel">Dónde comer</span>
        <span
          v-for="e in extrasComer"
          :key="e.key"
          class="daymap-x"
        ><b class="daymap-xl daymap-xl--comer">{{ e.letra }}</b> {{ e.nombre }}</span>
      </p>
    </div>
    <p class="daymap-key">
      <span class="daymap-key-walk" /> a pie · <span class="daymap-key-ride" /> metro o tren ·
      zonas y locales aproximados · Cartografía <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener nofollow"
      >© OpenStreetMap contributors</a>
    </p>
  </figure>
</template>

<style scoped>
.daymap {
  margin: 1.6rem 0 0;
  padding-top: 1.2rem;
  border-top: 1px solid var(--line);
}
.daymap-title {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--indigo);
  margin-bottom: 0.7rem;
}
.daymap-canvas {
  position: relative;
  max-width: 560px;
  margin: 0 auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.daymap-canvas img {
  display: block; width: 100%; height: 100%; object-fit: cover;
  filter: saturate(0.3) contrast(0.88) brightness(1.1);
}
.daymap-canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; }

.daymap-zone { fill: var(--indigo); fill-opacity: 0.12; stroke: var(--indigo); stroke-opacity: 0.75; stroke-width: 6; stroke-dasharray: 18 12; }
.daymap-zlabel {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 40px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  text-anchor: middle; dominant-baseline: hanging;
  fill: var(--indigo);
  paint-order: stroke; stroke: #fff; stroke-width: 10; stroke-linejoin: round;
}

.daymap-canvas polyline { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.daymap-halo { stroke: #fff; stroke-width: 22; opacity: 0.75; }
.daymap-walk { stroke: var(--accent); stroke-width: 13; stroke-dasharray: 0 22; }
.daymap-ride { stroke: var(--indigo); stroke-width: 8; stroke-dasharray: 26 18; stroke-linecap: butt; }

.daymap-stop circle { fill: var(--accent); stroke: #fff; stroke-width: 6; }
.daymap-stop--start circle { fill: var(--indigo); }
.daymap-stop text {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 34px; font-weight: 700; fill: #fff;
  text-anchor: middle; dominant-baseline: central;
}

.daymap-extra rect, .daymap-extra circle { stroke: #fff; stroke-width: 5; }
.daymap-extra--ver rect { fill: var(--indigo); }
.daymap-extra--comer circle { fill: var(--gold); }
.daymap-extra text {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 24px; font-weight: 700; fill: #fff;
  text-anchor: middle; dominant-baseline: central;
}

.daymap-extras { max-width: 560px; margin: 0.9rem auto 0; display: grid; gap: 0.45rem; }
.daymap-extras p { margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.8rem; font-size: 0.84rem; line-height: 1.35; }
.daymap-xlabel {
  flex-basis: 100%;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-soft);
}
.daymap-x { min-width: 0; overflow-wrap: break-word; }
.daymap-xl {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.15rem; height: 1.15rem; margin-right: 0.15rem;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.6rem; color: #fff;
}
.daymap-xl--ver { background: var(--indigo); border-radius: 3px; }
.daymap-xl--comer { background: var(--gold); border-radius: 50%; }

.daymap-legend {
  list-style: none;
  margin: 0.9rem auto 0;
  padding: 0;
  max-width: 560px;
  display: grid;
  gap: 0.35rem;
}
.daymap-legend li { font-size: 0.92rem; line-height: 1.35; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.2rem 0.5rem; }
.daymap-num {
  flex: none;
  width: 1.35rem; height: 1.35rem; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.66rem; font-weight: 700;
  align-self: center;
}
.daymap-num--start { background: var(--indigo); }
.daymap-name { font-weight: 600; min-width: 0; overflow-wrap: break-word; }
.daymap-meta {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.66rem; color: var(--ink-soft);
}
.daymap-mode { color: var(--indigo); }
.daymap-mode::before { content: '← '; }

.daymap-key {
  max-width: 560px;
  margin: 0.8rem auto 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem; color: var(--ink-faint);
  text-align: center;
}
.daymap-key a { color: var(--ink-faint); }
.daymap-key-walk, .daymap-key-ride { display: inline-block; width: 1.4rem; height: 0; vertical-align: middle; }
.daymap-key-walk { border-top: 3px dotted var(--accent); }
.daymap-key-ride { border-top: 2px dashed var(--indigo); }
</style>

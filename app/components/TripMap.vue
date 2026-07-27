<script setup>
// Mapa de referencia del viaje. SVG estático y autocontenido (sin red, offline-safe): la geometría
// del archipiélago se genera en build-time (scripts/build-map.mjs) y se importa como datos. Hereda
// la paleta kōyō vía var(--…), así que cambia con el tema.
import { viewBox, landPaths, cities as C } from './tripMapGeo.js'

// El TRAMO DE PABLO, por tierra y en orden de días (1-8): Kamakura (excursión) ← Tokio → Matsumoto
// → Kamikōchi. Se dibuja en trazo lleno porque es el tramo que él hace.
const routeKeys = ['kamakura', 'tokyo', 'matsumoto', 'kamikochi']
const routePoints = routeKeys.map(k => `${C[k].x},${C[k].y}`).join(' ')
// El resto del viaje del grupo, del 13 al 26: baja al oeste hasta Hiroshima y CIERRA EL BUCLE
// volviendo a Tokio, de donde salen las excursiones finales a Nikkō y al Fuji. En punteado.
const onwardPoints = ['kamikochi', 'takayama', 'kanazawa', 'kyoto', 'osaka', 'hiroshima', 'tokyo']
  .map(k => `${C[k].x},${C[k].y}`).join(' ')

// Paradas etiquetadas del tramo de Pablo.
const stops = [
  { key: 'tokyo', label: 'Tokio', dx: 8, dy: 4, anchor: 'start' },
  { key: 'kamakura', label: 'Kamakura', dx: 8, dy: 9, anchor: 'start' },
  { key: 'matsumoto', label: 'Matsumoto', dx: 8, dy: 5, anchor: 'start' },
  // Kamikōchi va ARRIBA: en el racimo de los Alpes hay cuatro topónimos en 45 unidades y una
  // etiqueta a la izquierda se comería la de Takayama.
  { key: 'kamikochi', label: 'Kamikōchi', dx: 0, dy: -11, anchor: 'middle' },
]
// El resto del itinerario del grupo: presente, pero en segundo plano.
const onward = [
  // Takayama va DEBAJO: sus dos segmentos (a Kanazawa y a Kamikōchi) suben, uno a cada lado.
  { key: 'takayama', label: 'Takayama', dx: 0, dy: 13, anchor: 'middle' },
  { key: 'kanazawa', label: 'Kanazawa', dx: -8, dy: -6, anchor: 'end' },
  { key: 'kyoto', label: 'Kioto', dx: -7, dy: -3, anchor: 'end' },
  { key: 'osaka', label: 'Osaka', dx: 7, dy: 8, anchor: 'start' },
  { key: 'hiroshima', label: 'Hiroshima', dx: -7, dy: 4, anchor: 'end' },
  // Las dos excursiones de la última semana, desde Tokio.
  { key: 'nikko', label: 'Nikkō', dx: 8, dy: -3, anchor: 'start' },
  { key: 'fuji', label: 'Fuji', dx: -6, dy: 9, anchor: 'end' },
]
// Referencias apagadas: los extremos del país que nadie pisa. El vacío del norte y del sur es
// justo la información — enseña que este viaje se queda en el centro de Honshū.
const refs = [
  { key: 'sapporo', label: 'Sapporo', dx: 8, dy: 4, anchor: 'start' },
  { key: 'fukuoka', label: 'Fukuoka', dx: 7, dy: 5, anchor: 'start' },
]
</script>

<template>
  <figure class="tripmap" aria-labelledby="tripmap-cap">
    <svg :viewBox="viewBox" role="img"
         aria-label="Mapa del viaje: un bucle por el centro y el oeste de Honshū. El tramo de Pablo, en trazo lleno, va de Tokio a Kamakura, Matsumoto y Kamikōchi; el resto del grupo continúa punteado hasta Hiroshima y vuelve a Tokio. Los extremos del archipiélago, Hokkaidō y Kyūshū, quedan fuera.">
      <!-- el archipiélago -->
      <path v-for="(d, i) in landPaths" :key="i" :d="d" class="land" />
      <!-- rótulo de país, al fondo -->
      <text x="150" y="250" class="country">JAPÓN</text>
      <!-- el resto del viaje del grupo, hasta el 26 -->
      <polyline :points="onwardPoints" class="flight" />
      <!-- el tramo de Pablo, por tierra -->
      <polyline :points="routePoints" class="route" />
      <!-- referencias no visitadas -->
      <g class="ref">
        <template v-for="r in refs" :key="r.key">
          <circle :cx="C[r.key].x" :cy="C[r.key].y" r="2.6" class="ref-dot" />
          <text :x="C[r.key].x + r.dx" :y="C[r.key].y + r.dy" :text-anchor="r.anchor" class="ref-label">{{ r.label }}</text>
        </template>
      </g>
      <!-- las paradas del grupo a partir del 13 de noviembre -->
      <g class="ref">
        <template v-for="o in onward" :key="o.key">
          <circle :cx="C[o.key].x" :cy="C[o.key].y" r="2.6" class="ref-dot" />
          <text :x="C[o.key].x + o.dx" :y="C[o.key].y + o.dy" :text-anchor="o.anchor" class="ref-label">{{ o.label }}</text>
        </template>
      </g>
      <!-- paradas del viaje -->
      <g class="stops">
        <template v-for="s in stops" :key="s.key">
          <circle :cx="C[s.key].x" :cy="C[s.key].y" r="3.4" class="stop-dot" />
          <text :x="C[s.key].x + s.dx" :y="C[s.key].y + s.dy" :text-anchor="s.anchor" class="stop-label">{{ s.label }}</text>
        </template>
      </g>
    </svg>
    <figcaption id="tripmap-cap" class="tripmap-cap">
      <span class="tripmap-legend"><i class="k-route" /> tramo de Pablo&ensp;<i class="k-flight" /> el grupo, hasta el 26</span>
      El viaje, de un vistazo: <strong>un bucle</strong> que sale de Tokio, sube a los Alpes, baja al
      oeste hasta Hiroshima y vuelve a Tokio a cerrar. Pablo hace el trazo lleno y vuela de vuelta
      desde Matsumoto <strong>el 13 de noviembre</strong>; los otros tres siguen el punteado.
    </figcaption>
  </figure>
</template>

<style scoped>
.tripmap {
  margin: 2.4rem auto 0.5rem;
  max-width: 330px;
  padding: 1rem 1.1rem 0.9rem;
  background: var(--bg-elev);
  border: 1px solid var(--line-soft);
  border-radius: 10px;
}
.tripmap svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.land {
  fill: var(--bg-soft);
  stroke: var(--line);
  stroke-width: 0.8;
  stroke-linejoin: round;
}
.country {
  fill: var(--ink-faint);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3.5px;
  opacity: 0.32;
  text-anchor: middle;
}
.flight {
  fill: none;
  stroke: var(--accent-soft);
  stroke-width: 1.4;
  stroke-dasharray: 4 3.2;
  stroke-linecap: round;
  opacity: 0.85;
}
.route {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.1;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.stop-dot {
  fill: var(--accent);
  stroke: var(--bg-elev);
  stroke-width: 1.1;
}
.stop-label {
  fill: var(--ink);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--bg-elev);
  stroke-width: 2.4;
}
.ref-dot {
  fill: none;
  stroke: var(--ink-faint);
  stroke-width: 1.2;
}
.ref-label {
  fill: var(--ink-faint);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 500;
  font-style: italic;
  paint-order: stroke;
  stroke: var(--bg-elev);
  stroke-width: 2.2;
}
.tripmap-cap {
  margin-top: 0.7rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--ink-soft);
  text-align: center;
}
.tripmap-cap strong { color: var(--ink); font-weight: 600; }
.tripmap-legend {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--ink-faint);
  font-size: 0.68rem;
}
.tripmap-legend i {
  display: inline-block;
  width: 16px;
  height: 0;
  vertical-align: middle;
  margin-right: 0.15rem;
}
.k-route { border-top: 2.4px solid var(--accent); }
.k-flight { border-top: 2px dotted var(--accent-soft); }
</style>

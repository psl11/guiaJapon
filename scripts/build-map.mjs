// Genera app/components/tripMapGeo.js: contorno simplificado de Japón y las coordenadas
// proyectadas de las paradas del viaje, para el mapa de referencia (TripMap.vue).
//
// Uso:  node scripts/build-map.mjs
//
// Descarga el contorno de georgique/world-geojson, lo simplifica con Douglas-Peucker y lo proyecta
// (equirectangular, norte arriba). El resultado es un módulo estático: NO se ejecuta en build ni en
// runtime, solo cuando hace falta regenerar la geometría. No editar tripMapGeo.js a mano.
//
// Diferencia con la versión de guiaVietnam: allí bastaba el anillo exterior MÁS GRANDE porque
// Vietnam y Camboya son tierra continua. Japón es un archipiélago — quedarse con un solo anillo
// dibujaría Honshū y borraría Hokkaidō, Kyūshū y Shikoku. Aquí se conservan los N mayores.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'components', 'tripMapGeo.js')
const SRC = 'https://raw.githubusercontent.com/georgique/world-geojson/develop/countries'
const ISLANDS = 8 // Honshū, Shikoku, Kyūshū, Hokkaidō + las cuatro islas menores siguientes

// --- proyección equirectangular (norte arriba), longitud corregida por cos(lat medio) ---
const LON0 = 128.5, LAT1 = 45.8, K = Math.cos((38 * Math.PI) / 180), SCALE = 40
const px = lon => (lon - LON0) * K * SCALE
const py = lat => (LAT1 - lat) * SCALE

// --- Douglas-Peucker sobre lon/lat (eps en grados) ---
function perp(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy
  if (L2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}
function dp(pts, eps) {
  if (pts.length < 3) return pts
  let dmax = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1])
    if (d > dmax) { dmax = d; idx = i }
  }
  if (dmax > eps) return dp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(dp(pts.slice(idx), eps))
  return [pts[0], pts[pts.length - 1]]
}

const res = await fetch(`${SRC}/japan.json`)
if (!res.ok) throw new Error(`japan: HTTP ${res.status}`)
const gj = await res.json()

// OJO: este fichero NO es un único MultiPolygon, es una FeatureCollection con 211 features (una por
// isla). Hay que recorrerlas TODAS y juntar sus anillos exteriores: quedarse con features[0] daría
// Hokkaidō a secas y borraría el resto del país.
const feats = gj.features ?? [gj]
const rings = feats
  .flatMap((f) => {
    const geom = f.geometry ?? f
    if (!geom?.coordinates) return []
    return (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map(p => p[0])
  })
  .sort((a, b) => b.length - a.length)
  .slice(0, ISLANDS)
const simplified = rings.map(r => dp(r, 0.035)).filter(r => r.length > 8)
const landPaths = simplified.map(ring =>
  ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z',
)

// --- paradas y referencias [lon, lat] ---
const raw = {
  tokyo: [139.6917, 35.6895], kamakura: [139.5467, 35.3192], matsumoto: [137.9720, 36.2381],
  kamikochi: [137.6333, 36.2500], takayama: [137.2517, 36.1461], nagoya: [136.9066, 35.1815],
  kanazawa: [136.6256, 36.5613], kyoto: [135.7681, 35.0116], osaka: [135.5023, 34.6937],
  hiroshima: [132.4553, 34.3853], fuji: [138.7274, 35.3606], nikko: [139.5986, 36.7198],
  sapporo: [141.3545, 43.0618], fukuoka: [130.4017, 33.5904],
}
const cities = {}
for (const [k, [lon, lat]] of Object.entries(raw)) cities[k] = { x: +px(lon).toFixed(1), y: +py(lat).toFixed(1) }

// --- viewBox = bbox de la tierra + margen ---
const pts = simplified.flat().map(([lon, lat]) => [px(lon), py(lat)])
const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), M = 16
const vb = [Math.min(...xs) - M, Math.min(...ys) - M, Math.max(...xs) - Math.min(...xs) + 2 * M, Math.max(...ys) - Math.min(...ys) + 2 * M]
const viewBox = vb.map(n => n.toFixed(1)).join(' ')

writeFileSync(OUT, `// Geometría del mapa del viaje — GENERADA por scripts/build-map.mjs (node scripts/build-map.mjs).
// Fuente: georgique/world-geojson, simplificada con Douglas-Peucker y proyectada (equirectangular,
// norte arriba). Estática: no requiere red en build ni en runtime. No editar a mano.
export const viewBox = ${JSON.stringify(viewBox)}
export const landPaths = ${JSON.stringify(landPaths)}
export const cities = ${JSON.stringify(cities)}
`)
console.log(`tripMapGeo.js regenerado · ${landPaths.length} islas · ${simplified.reduce((n, r) => n + r.length, 0)} pts · viewBox ${viewBox}`)

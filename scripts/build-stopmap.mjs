// Genera el MAPA REAL de cada parada de «Dónde dormir»: una imagen WebP con la cartografía de
// OpenStreetMap y el módulo de geometría que coloca los marcadores encima.
//
// Uso:  node scripts/build-stopmap.mjs
//
// POR QUÉ HORNEADO Y NO UN WIDGET. Un mapa vivo (Google Maps, Leaflet) pide tiles por red mientras
// se hace pan y zoom, y esos tiles NO se pueden precachear porque no se pueden enumerar: sólo sabes
// cuáles necesitas cuando el usuario arrastra. Esta guía tiene precaché total y una puerta en CI
// (scripts/check-offline.mjs); un mapa vivo la rompería. Horneado, el mapa es una imagen más del
// precache y funciona en un avión igual que las otras 69 fotos.
//
// NO se ejecuta en build ni en runtime — sólo a mano, cuando cambian los alojamientos. Igual que
// scripts/build-map.mjs, del que copia el patrón.
//
// CORTESÍA CON OSM: su política prohíbe la descarga masiva. Aquí son ~12 tiles por parada, una sola
// vez, con User-Agent identificativo y una pausa entre peticiones. La atribución «© OpenStreetMap
// contributors» que exige la licencia la pinta StopMap.vue, y es obligatoria: no la quites.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOTELS = join(ROOT, 'content/trips/japon/hoteles')
const PARADAS = join(ROOT, 'content/trips/japon/paradas')
const IMG_DIR = join(ROOT, 'public/img/mapas')
const OUT = join(ROOT, 'app/components/stopMapsGeo.js')

const TILE = 256
const UA = 'guiaJapon/1.0 (mapa estático de una guía de viaje personal; https://github.com/psl11/guiaJapon)'
const PAD = 0.14 // margen alrededor del grupo de puntos, en fracción del lado mayor
// Techo generoso a propósito: manda el DETALLE, no el peso. Con 900 px este barrio caía a z16 y la
// imagen (371×605) se veía borrosa al escalarla en la tarjeta; a z17 son 742×1210 px y ~200 KB, muy
// por debajo del tope de 500 KB por imagen que vigila scripts/check-weight.mjs.
const MAX_PX = 1400
const MIN_SPAN_M = 420 // si los puntos están muy juntos, no acercar más de esto (evita el zoom absurdo)

// --- Web Mercator: (lon,lat) → píxel absoluto en el mundo, a un zoom dado ---
const lon2px = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z
const lat2px = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function tile(z, x, y) {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// Slug de parada: el mismo que usan TripView (stopSlug) y el test de anclas.
const stopSlug = c => 'hotel-' + c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// --- 1. leer el contenido y agrupar por parada -------------------------------
const hoteles = readdirSync(HOTELS).filter(f => f.endsWith('.yml'))
  .map(f => parse(readFileSync(join(HOTELS, f), 'utf8')))
  .sort((a, b) => a.order - b.order)

const stops = new Map()
for (const h of hoteles) {
  if (!stops.has(h.city)) stops.set(h.city, [])
  stops.get(h.city).push(h)
}

// Puntos de interés por parada. La clave de unión es `city`, que tiene que coincidir letra a letra
// con la de los hoteles; si no, la parada se queda sin puntos y el aviso de abajo lo canta.
const puntosPorCity = new Map()
if (existsSync(PARADAS)) {
  for (const f of readdirSync(PARADAS).filter(f => f.endsWith('.yml'))) {
    const p = parse(readFileSync(join(PARADAS, f), 'utf8'))
    puntosPorCity.set(p.city, p.puntos ?? [])
  }
}

if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true })
const geo = {}

for (const [city, list] of stops) {
  const slug = stopSlug(city)

  // Puntos a encuadrar: los hoteles con coordenadas verificadas y sus estaciones.
  const pts = []
  const estaciones = new Map()
  for (const h of list) {
    if (h.lat != null && h.lon != null) pts.push({ kind: 'hotel', slug: h.slug, title: h.title, status: h.status, lat: h.lat, lon: h.lon })
    for (const e of h.estaciones ?? []) {
      if (e.lat == null || e.lon == null) continue
      if (!estaciones.has(e.nombre)) estaciones.set(e.nombre, { kind: 'estacion', nombre: e.nombre, lat: e.lat, lon: e.lon })
    }
  }
  pts.push(...estaciones.values())

  const puntos = puntosPorCity.get(city)
  if (puntos === undefined) console.log(`  ⚠ ${city}: sin fichero en content/trips/japon/paradas (¿el "city" coincide?)`)
  for (const p of puntos ?? []) pts.push({ kind: 'punto', nombre: p.nombre, tipo: p.tipo, lat: p.lat, lon: p.lon })

  if (pts.length < 2) {
    console.log(`· ${city}: sin coordenadas suficientes, se salta`)
    continue
  }

  // --- 2. encuadre: caja de los puntos + margen, forzando un mínimo de campo ---
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((midLat * Math.PI) / 180)

  let hM = (Math.max(...lats) - Math.min(...lats)) * mPerDegLat
  let wM = (Math.max(...lons) - Math.min(...lons)) * mPerDegLon
  const pad = Math.max(hM, wM) * PAD
  hM = Math.max(hM + pad * 2, MIN_SPAN_M)
  wM = Math.max(wM + pad * 2, MIN_SPAN_M)

  const dLat = hM / mPerDegLat / 2, dLon = wM / mPerDegLon / 2
  const north = midLat + dLat, south = midLat - dLat
  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2
  const west = midLon - dLon, east = midLon + dLon

  // --- 3. zoom: el mayor que quepa en MAX_PX (más zoom = más detalle de calle) ---
  let z = 18
  for (; z > 12; z--) {
    if (lon2px(east, z) - lon2px(west, z) <= MAX_PX && lat2px(south, z) - lat2px(north, z) <= MAX_PX) break
  }

  const x0 = lon2px(west, z), y0 = lat2px(north, z)
  const x1 = lon2px(east, z), y1 = lat2px(south, z)
  const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE)
  const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE)
  const cols = tx1 - tx0 + 1, rowsN = ty1 - ty0 + 1

  console.log(`· ${city}: z${z}, ${cols}×${rowsN} tiles, recorte ${Math.round(x1 - x0)}×${Math.round(y1 - y0)} px`)

  // --- 4. descargar y coser ---------------------------------------------------
  const composites = []
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      composites.push({ input: await tile(z, tx, ty), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE })
      await sleep(220) // cortesía con el servidor de tiles
    }
  }

  const stitched = await sharp({
    create: { width: cols * TILE, height: rowsN * TILE, channels: 3, background: '#e8e0d8' },
  }).composite(composites).png().toBuffer()

  // --- 5. recortar a la caja exacta y codificar -------------------------------
  const cropL = Math.round(x0 - tx0 * TILE), cropT = Math.round(y0 - ty0 * TILE)
  const cropW = Math.round(x1 - x0), cropH = Math.round(y1 - y0)
  const rel = `img/mapas/${slug}.webp`
  await sharp(stitched)
    .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
    .webp({ quality: 76 })
    .toFile(join(IMG_DIR, `${slug}.webp`))

  // --- 6. posición de cada marcador, en % sobre la imagen ---------------------
  const pct = p => ({
    x: +(((lon2px(p.lon, z) - x0) / cropW) * 100).toFixed(3),
    y: +(((lat2px(p.lat, z) - y0) / cropH) * 100).toFixed(3),
  })

  geo[slug] = {
    image: rel,
    w: cropW,
    h: cropH,
    hoteles: pts.filter(p => p.kind === 'hotel').map(p => ({ slug: p.slug, title: p.title, status: p.status, ...pct(p) })),
    estaciones: pts.filter(p => p.kind === 'estacion').map(p => ({ nombre: p.nombre, ...pct(p) })),
    puntos: pts.filter(p => p.kind === 'punto').map(p => ({ nombre: p.nombre, tipo: p.tipo, ...pct(p) })),
  }
}

writeFileSync(OUT, `// Geometría de los mapas de «Dónde dormir» — GENERADA por scripts/build-stopmap.mjs.
// Cartografía © OpenStreetMap contributors (ODbL). La atribución la pinta StopMap.vue y es
// obligatoria por licencia. Las coordenadas salen del contenido (content/trips/*/hoteles/*.yml).
// No editar a mano: se regenera con \`node scripts/build-stopmap.mjs\`.
export const stopMaps = ${JSON.stringify(geo, null, 2)}
`)

console.log(`\n✓ ${Object.keys(geo).length} mapa(s) en public/img/mapas/ y geometría en app/components/stopMapsGeo.js`)

// Genera los MAPAS DE RECORRIDO de los días: cartografía de OpenStreetMap horneada en WebP y los
// trazados encima, que pintan RouteMap.vue y DayMap.vue. Dos tipos:
//
//  · `ruta` de un bloque — un paseo corto de A a B (RouteMap).
//  · `mapa` de un día    — el día entero de un vistazo: paradas numeradas, zonas y tramos (DayMap).
//
// Uso:  node scripts/build-routemap.mjs
//
// Hermano de scripts/build-stopmap.mjs, del que copia el patrón (teselas, Web Mercator, recorte).
// Los tramos A PIE salen del enrutador peatonal de OSM (routing.openstreetmap.de, perfil foot): los
// puntitos siguen las calles de verdad. Los de metro o tren son una recta discontinua a propósito —
// el mapa dice «de aquí se va en metro hasta allí», no por dónde va el túnel.
//
// NO se ejecuta en build ni en runtime — sólo a mano, cuando se añade o cambia una `ruta` o un `mapa`.
// CORTESÍA CON OSM: pocas teselas, una vez, con User-Agent identificativo y pausa entre peticiones.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TRIP = join(ROOT, 'content/trips/japon')
const DIAS = join(TRIP, 'dias')
const IMG_DIR = join(ROOT, 'public/img/rutas')
const OUT = join(ROOT, 'app/components/routeMapsGeo.js')

const TILE = 256
const UA = 'guiaJapon/1.0 (mapa estático de una guía de viaje personal; https://github.com/psl11/guiaJapon)'

const lon2px = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z
const lat2px = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const M_LAT = 111320
const mLon = lat => 111320 * Math.cos((lat * Math.PI) / 180)

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res
}

async function aPie(a, b) {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`
  const r = (await (await get(url)).json()).routes?.[0]
  await sleep(300)
  if (!r) throw new Error(`sin ruta a pie entre ${a.nombre} y ${b.nombre}`)
  return { coords: r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), metros: r.distance, segundos: r.duration }
}

// Descarga, cose y recorta las teselas que encuadran `pts`. Devuelve un proyector a píxeles.
async function hornear(slug, pts, { pad, maxPx, minSpan }) {
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2
  let hM = (Math.max(...lats) - Math.min(...lats)) * M_LAT
  let wM = (Math.max(...lons) - Math.min(...lons)) * mLon(midLat)
  const margin = Math.max(hM, wM) * pad
  hM = Math.max(hM + margin * 2, minSpan)
  wM = Math.max(wM + margin * 2, minSpan)
  const dLat = hM / M_LAT / 2, dLon = wM / mLon(midLat) / 2
  const north = midLat + dLat, south = midLat - dLat, west = midLon - dLon, east = midLon + dLon

  let z = 18
  for (; z > 12; z--) {
    if (lon2px(east, z) - lon2px(west, z) <= maxPx && lat2px(south, z) - lat2px(north, z) <= maxPx) break
  }
  const x0 = lon2px(west, z), y0 = lat2px(north, z), x1 = lon2px(east, z), y1 = lat2px(south, z)
  const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE)
  const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE)
  const cols = tx1 - tx0 + 1, rowsN = ty1 - ty0 + 1
  console.log(`· ${slug}: z${z}, ${cols}×${rowsN} tiles`)

  const composites = []
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const buf = Buffer.from(await (await get(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`)).arrayBuffer())
      composites.push({ input: buf, left: (tx - tx0) * TILE, top: (ty - ty0) * TILE })
      await sleep(220)
    }
  }
  const stitched = await sharp({
    create: { width: cols * TILE, height: rowsN * TILE, channels: 3, background: '#e8e0d8' },
  }).composite(composites).png().toBuffer()

  const w = Math.round(x1 - x0), h = Math.round(y1 - y0)
  await sharp(stitched)
    .extract({ left: Math.round(x0 - tx0 * TILE), top: Math.round(y0 - ty0 * TILE), width: w, height: h })
    .webp({ quality: 76 }).toFile(join(IMG_DIR, `${slug}.webp`))

  // Coordenadas en píxeles de la imagen: los componentes usan un viewBox 0 0 w h del mismo tamaño.
  const px = p => [+(lon2px(p.lon, z) - x0).toFixed(1), +(lat2px(p.lat, z) - y0).toFixed(1)]
  const mPx = (2 ** z * TILE) / (40075016 * Math.cos((midLat * Math.PI) / 180)) // píxeles por metro
  return { image: `img/rutas/${slug}.webp`, w, h, px, mPx }
}

// --- leer el contenido --------------------------------------------------------
const cargar = dir => new Map(readdirSync(join(TRIP, dir)).filter(f => f.endsWith('.yml'))
  .map(f => parse(readFileSync(join(TRIP, dir, f), 'utf8'))).map(d => [d.slug, d]))
const comidas = cargar('comidas'), recos = cargar('recomendados')

// Lo que se ve y se come en el día, con posición: va al mapa como punto con letra (A, B, C…) en el
// orden en que aparece en los bloques. La clave es la misma que calcula DiaCard (ver `extraKey`),
// que es como la lista del bloque sabe qué letra lleva cada cosa en el mapa.
function extrasDe(dia) {
  const out = new Map()
  for (const b of dia.blocks ?? []) {
    for (const v of b.ver ?? []) {
      const src = v.reco ? recos.get(v.reco) : v
      if (v.ficha || src?.lat == null) continue
      const key = v.reco ? `reco:${v.reco}` : `ver:${v.nombre}`
      out.set(key, { key, tipo: 'ver', nombre: src.title ?? v.nombre, lat: src.lat, lon: src.lon })
    }
    for (const c of b.comer ?? []) {
      const src = comidas.get(c.comida)
      if (src?.lat == null) continue
      out.set(`comida:${c.comida}`, { key: `comida:${c.comida}`, tipo: 'comer', nombre: src.title, lat: src.lat, lon: src.lon })
    }
  }
  return [...out.values()]
}

const rutas = [], mapas = []
for (const f of readdirSync(DIAS).filter(f => f.endsWith('.yml'))) {
  const dia = parse(readFileSync(join(DIAS, f), 'utf8'))
  for (const b of dia.blocks ?? []) if (b.ruta) rutas.push(b.ruta)
  if (!dia.mapa) continue
  // Lo que ya es una parada del recorrido (Kappabashi, el museo) no se repite como punto con letra.
  const cerca = (a, b) => Math.hypot((a.lat - b.lat) * M_LAT, (a.lon - b.lon) * mLon(a.lat)) < 120
  // Pero la lista del bloque sí lo señala: con el número de esa parada en vez de una letra.
  // Y lo que cae lejos del recorrido (Himeji en el día de Hiroshima, la cena de Tokio en el de
  // Kanazawa) se queda fuera del mapa: estiraría el encuadre a cientos de kilómetros. Sale en la
  // lista del bloque, sin letra.
  const dist = (a, b) => Math.hypot((a.lat - b.lat) * M_LAT, (a.lon - b.lon) * mLon(a.lat))
  const todos = extrasDe(dia).filter(e => dia.mapa.paradas.some(p => dist(p, e) < 2500)), enParada = {}
  for (const e of todos) {
    const i = dia.mapa.paradas.findIndex(p => cerca(p, e))
    if (i >= 0) enParada[e.key] = i === 0 ? 'S' : String(i)
  }
  mapas.push({ ...dia.mapa, extras: todos.filter(e => !(e.key in enParada)), enParada })
}
if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true })

// --- 1. rutas de bloque: A → B a pie -----------------------------------------
const routeMaps = {}
for (const { slug, desde, hasta } of rutas) {
  const { coords, metros, segundos } = await aPie(desde, hasta)
  const m = await hornear(slug, [desde, hasta, ...coords], { pad: 0.18, maxPx: 1100, minSpan: 360 })
  routeMaps[slug] = {
    image: m.image, w: m.w, h: m.h,
    metros: Math.round(metros / 10) * 10,
    minutos: Math.max(1, Math.round(segundos / 60)),
    path: coords.map(m.px),
    desde: m.px(desde),
    hasta: m.px(hasta),
  }
}

// --- 2. mapas de día: paradas, tramos y zonas --------------------------------
const dayMaps = {}
for (const { slug, paradas, extras, enParada } of mapas) {
  // Tramos: cada parada (salvo la primera) dice cómo se llega desde la anterior.
  const tramos = []
  for (let i = 1; i < paradas.length; i++) {
    const a = paradas[i - 1], b = paradas[i]
    const modo = b.llegada ?? 'a-pie'
    tramos.push({ modo, coords: modo === 'a-pie' ? (await aPie(a, b)).coords : [a, b] })
  }

  // Zonas: centro y radio salen de sus paradas (más un margen), no de un punto puesto a ojo.
  const porZona = new Map()
  for (const p of paradas) if (p.zona) porZona.set(p.zona, [...(porZona.get(p.zona) ?? []), p])
  const zonas = [...porZona].map(([nombre, ps]) => {
    const lat = ps.reduce((s, p) => s + p.lat, 0) / ps.length
    const lon = ps.reduce((s, p) => s + p.lon, 0) / ps.length
    const r = Math.max(...ps.map(p => Math.hypot((p.lat - lat) * M_LAT, (p.lon - lon) * mLon(lat))))
    return { nombre, lat, lon, radioM: r + 340 }
  })

  // El encuadre incluye el borde de cada zona, para que ningún círculo quede cortado.
  const bordes = zonas.flatMap(z => [
    { lat: z.lat + z.radioM / M_LAT, lon: z.lon }, { lat: z.lat - z.radioM / M_LAT, lon: z.lon },
    { lat: z.lat, lon: z.lon + z.radioM / mLon(z.lat) }, { lat: z.lat, lon: z.lon - z.radioM / mLon(z.lat) },
  ])
  const m = await hornear(slug, [...paradas, ...extras, ...tramos.flatMap(t => t.coords), ...bordes], { pad: 0.06, maxPx: 1600, minSpan: 800 })

  dayMaps[slug] = {
    image: m.image, w: m.w, h: m.h,
    paradas: paradas.map(m.px),
    tramos: tramos.map(t => ({ modo: t.modo, path: t.coords.map(m.px) })),
    zonas: zonas.map(z => ({ nombre: z.nombre, c: m.px(z), r: +(z.radioM * m.mPx).toFixed(1) })),
    enParada,
    extras: extras.map((e, i) => ({ key: e.key, tipo: e.tipo, nombre: e.nombre, letra: String.fromCharCode(65 + i), xy: m.px(e) })),
  }
}

writeFileSync(OUT, `// Geometría de los mapas de recorrido — GENERADA por scripts/build-routemap.mjs.
// Cartografía y trazados © OpenStreetMap contributors (ODbL). La atribución la pintan los componentes.
// No editar a mano: se regenera con \`node scripts/build-routemap.mjs\`.
export const routeMaps = ${JSON.stringify(routeMaps)}
export const dayMaps = ${JSON.stringify(dayMaps)}
`)
console.log(`\n✓ ${rutas.length} ruta(s) y ${mapas.length} mapa(s) de día en public/img/rutas/`)

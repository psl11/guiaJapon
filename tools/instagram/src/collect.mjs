// PASO 1 — Cosecha.
//
// Autónomo: no pide nada por teclado. Abre el navegador y se queda esperando. Detecta solo
// cuándo te has logueado y cuándo abres una colección de guardados; entonces baja por la
// rejilla y vuelca. Al terminar una colección vuelve a esperar, así que puedes ir abriendo
// una tras otra sin relanzar nada. Se cierra cuando cierras el navegador.
//
// Por qué interceptar la red y no leer el DOM: la rejilla solo pinta la miniatura, pero las
// llamadas que la alimentan (/api/v1/feed/... y /graphql/query) traen el objeto completo —
// caption, hashtags, ubicación con coordenadas, autor, URL del vídeo. Leyendo el DOM habría
// que abrir los posts uno a uno; así sale todo del mismo scroll que harías tú con el dedo.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { openBrowser, isLoggedIn, DATA } from './session.mjs'

const RAW = join(DATA, 'raw')
const MEDIA = join(DATA, 'media.json')
const log = msg => console.log(`${new Date().toTimeString().slice(0, 8)}  ${msg}`)

// Encuentra los posts en cualquier JSON, sea cual sea el endpoint. Instagram alterna dos
// formas (api/v1 con `code`, graphql con `shortcode`) y las cambia cada pocos meses;
// buscar por forma en vez de por ruta lo hace resistente a eso.
function * walk (node) {
  if (!node || typeof node !== 'object') return
  yield node
  for (const value of Object.values(node)) if (value && typeof value === 'object') yield * walk(value)
}

function harvestMedia (json) {
  const found = []
  for (const node of walk(json)) {
    if (Array.isArray(node)) continue
    const code = node.code ?? node.shortcode
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{8,14}$/.test(code)) continue
    const looksLikeMedia = 'media_type' in node || 'image_versions2' in node ||
      'display_url' in node || 'video_versions' in node || 'thumbnail_url' in node
    if (looksLikeMedia) found.push({ code, node })
  }
  return found
}

const ctx = await openBrowser()
let cerrado = false
ctx.on('close', () => { cerrado = true })

const media = existsSync(MEDIA) ? JSON.parse(readFileSync(MEDIA, 'utf8')) : {}
const arranque = Object.keys(media).length
const payloads = []

ctx.on('response', async res => {
  const url = res.url()
  if (!/instagram\.com\/(api\/v1|graphql)/.test(url)) return
  if (!/json/i.test(res.headers()['content-type'] ?? '')) return
  let json
  try { json = await res.json() } catch { return }
  const found = harvestMedia(json)
  if (!found.length) return
  payloads.push({ url, json })
  for (const { code, node } of found) media[code] = node
})

function guardar () {
  mkdirSync(RAW, { recursive: true })
  writeFileSync(MEDIA, JSON.stringify(media, null, 2))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(join(RAW, `capture-${stamp}.json`), JSON.stringify(payloads, null, 2))
}

const total = () => Object.keys(media).length
const espera = ms => new Promise(r => setTimeout(r, ms))
const activa = () => { const p = ctx.pages(); return p[p.length - 1] }

const page = ctx.pages()[0] ?? await ctx.newPage()
await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' }).catch(() => {})

// ── 1 · Esperar al login ──────────────────────────────────────────────────────
if (!await isLoggedIn(ctx)) {
  log('Esperando a que inicies sesión en la ventana del navegador...')
  while (!cerrado && !await isLoggedIn(ctx)) await espera(2000)
}
if (cerrado) process.exit(0)
log('Sesión detectada. Todo tuyo.')
console.log(`
   ┌──────────────────────────────────────────────────────────────┐
   │  En el navegador: tu perfil → icono de marcador (Guardado)   │
   │  → entra en una colección.                                   │
   │                                                              │
   │  El volcado arranca solo. Puedes ir abriendo una colección   │
   │  tras otra. Cierra el navegador cuando hayas acabado.        │
   └──────────────────────────────────────────────────────────────┘
`)

// ── 2 · Vigilar. Cuando aparezca una colección, bajar por ella ────────────────
const hechas = new Set()
let avisado = false

while (!cerrado) {
  const page = activa()
  if (!page || page.isClosed()) { await espera(1500); continue }

  const url = page.url()
  const esColeccion = /instagram\.com\/[^/]+\/saved\/[^/]+/.test(url)

  if (!esColeccion) {
    if (!avisado) { log('Esperando a que abras una colección de guardados...'); avisado = true }
    await espera(1500)
    continue
  }

  const clave = url.split('?')[0]
  if (hechas.has(clave)) { await espera(2500); continue }
  hechas.add(clave)
  avisado = false

  const nombre = decodeURIComponent(clave.split('/saved/')[1].replace(/\/$/, ''))
  const antes = total()
  log(`Colección detectada: «${nombre}». Recargando para capturar el primer lote...`)

  // El primer lote se pidió antes de que llegáramos: recargar es la forma de no perderlo.
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await espera(3500)

  log('Bajando por la rejilla. No toques el navegador.')
  let ultimo = -1
  let quieto = 0
  let vueltas = 0
  while (!cerrado && quieto < 6 && vueltas < 600) {
    if (page.isClosed() || !/\/saved\//.test(page.url())) break
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.85)).catch(() => {})
    await espera(1100)
    const n = total()
    if (n === ultimo) quieto++
    else { quieto = 0; ultimo = n; if (n % 24 === 0) log(`   ${n} posts...`) }
    vueltas++
  }
  await espera(2000)
  guardar()
  log(`«${nombre}» lista: +${total() - antes} nuevos · ${total()} en la base. Abre otra colección o cierra el navegador.`)
}

guardar()
console.log(`
  Volcado terminado.
    en la base al empezar ..... ${arranque}
    nuevos en esta sesión ..... ${total() - arranque}
    total ..................... ${total()}
    colecciones recorridas .... ${hechas.size}
    respuestas guardadas ...... ${payloads.length}

  Siguiente: npm run parse && npm run identify
`)
process.exit(0)

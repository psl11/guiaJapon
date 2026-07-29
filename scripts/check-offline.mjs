#!/usr/bin/env node
/**
 * Puerta del OFFLINE. Se ejecuta sobre `.output/public` después de `nuxi generate`.
 *
 * Existe porque el offline se rompió tres veces seguidas **en silencio**: con cobertura el sitio
 * funcionaba perfecto y nada avisaba. Se descubrió abriendo las guías en un avión, que es el peor
 * sitio posible para descubrirlo. Ningún test de datos ve esto: hay que mirar el service worker
 * generado, no el contenido.
 *
 * Comprueba, en este orden de gravedad:
 *
 *   1. Que TODA entrada del precache exista como fichero. Nuxt genera 200.html y 404.html para el
 *      fallback de GitHub Pages y workbox los mete en el manifiesto SIN extensión (/base/200), URL
 *      que no existen en el servidor. Como precacheAndRoute usa addAll(), UNA sola petición fallida
 *      aborta la instalación entera: el SW no se activa nunca y no hay offline en absoluto.
 *   2. Que esté `ignoreURLParametersMatching`. Nuxt pide el payload con query de build
 *      (_payload.json?<uuid>) y workbox lo guarda sin query: sin esto el lookup falla, cae a la red
 *      y offline sale un 500 de Nuxt («Cannot read properties of undefined»).
 *   3. Que el wasm esté precacheado. @nuxt/content v3 lee el contenido con SQLite compilado a
 *      WebAssembly; sin él los sql_dump.txt cacheados no sirven de nada.
 *   4. Que no se quede fuera ninguna familia de ficheros que el sitio necesita para pintarse.
 *   5. Que el navigateFallback apunte a algo que está en el precache.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIR = '.output/public'
const SW = join(DIR, 'sw.js')

if (!existsSync(SW)) {
  console.error('✗ No hay .output/public/sw.js — ¿se ha ejecutado `nuxi generate`?')
  process.exit(1)
}

const sw = readFileSync(SW, 'utf8')
const entradas = [...sw.matchAll(/url:"([^"]+)"/g)].map(m => m[1])
const base = (sw.match(/createHandlerBoundToURL\("([^"]+)"\)/) || [, '/'])[1]

const errores = []
const avisos = []

// ── 1 · toda entrada del precache tiene que existir en disco ──────────────────
const aFichero = (u) => {
  let p = u.startsWith(base) ? u.slice(base.length) : u
  p = p.replace(/^\//, '')
  if (p === '' || p.endsWith('/')) p += 'index.html'
  return join(DIR, decodeURIComponent(p))
}
const fantasmas = entradas.filter(u => !existsSync(aFichero(u)))
if (fantasmas.length) {
  errores.push(
    `${fantasmas.length} entrada(s) del precache NO existen como fichero: ${fantasmas.join(', ')}\n` +
    '    → una sola petición fallida aborta la instalación del SW y deja el sitio SIN offline.\n' +
    "    → si son 200/404, la causa es que workbox les quita el .html: usa globIgnores.")
}

// ── 2 · el payload se pide con query de build ─────────────────────────────────
if (!/ignoreURLParametersMatching/.test(sw)) {
  errores.push('Falta `ignoreURLParametersMatching` en el workbox.\n' +
    '    → Nuxt pide _payload.json?<uuid> y el precache lo tiene sin query: offline da un 500.')
}

// ── 3 · el motor que lee el contenido ─────────────────────────────────────────
const wasmEnDisco = []
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.wasm')) wasmEnDisco.push(p) } }
walk(DIR)
const wasmPrecacheado = entradas.filter(u => u.endsWith('.wasm')).length
if (wasmEnDisco.length && !wasmPrecacheado) {
  errores.push(`Hay ${wasmEnDisco.length} .wasm en el build y NINGUNO precacheado.\n` +
    '    → @nuxt/content lee el contenido con SQLite en WASM: sin él, offline no hay guía.\n' +
    "    → añade `wasm` a globPatterns.")
}

// ── 4 · ninguna familia de ficheros se queda fuera en silencio ────────────────
const IGNORABLES = new Set(['.nojekyll', 'sw.js', 'manifest.webmanifest'])
const todos = []
const walk2 = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, e.name); if (e.isDirectory()) walk2(p); else todos.push(p.slice(DIR.length + 1)) } }
walk2(DIR)
const precacheados = new Set(entradas.map(u => aFichero(u).slice(DIR.length + 1)))
const fuera = todos.filter(f =>
  !precacheados.has(f) && !IGNORABLES.has(f) && !f.startsWith('workbox-') &&
  !['200.html', '404.html'].includes(f))          // estos NO deben ir: los sirve GH Pages, no el SW
const porTipo = {}
for (const f of fuera) (porTipo[extname(f) || '(sin ext)'] ??= []).push(f)
for (const [ext, list] of Object.entries(porTipo)) {
  if (['.map', '.txt'].includes(ext) && list.every(f => f.includes('.map'))) continue
  avisos.push(`sin precachear: ${list.length} × ${ext} — ${list.slice(0, 3).join(', ')}`)
}

// ── 5 · el fallback de navegación tiene que estar en el precache ──────────────
if (!entradas.includes(base)) {
  errores.push(`El navigateFallback apunta a "${base}" y esa URL no está en el precache.\n` +
    '    → offline, cualquier navegación fallará.')
}

// ── salida ────────────────────────────────────────────────────────────────────
const pesoMB = todos.reduce((n, f) => n + statSync(join(DIR, f)).size, 0) / 1048576
console.log('Puerta del offline:')
console.log(`  · ${entradas.length} entradas en el precache · ${wasmPrecacheado} wasm · ${pesoMB.toFixed(1)} MB de sitio`)
console.log(`  · navigateFallback: ${base}${entradas.includes(base) ? ' ✓' : ' ✗'}`)
for (const a of avisos) console.log(`  ⚠ ${a}`)

if (errores.length) {
  console.error('\n✗ EL OFFLINE ESTÁ ROTO:\n')
  for (const e of errores) console.error('  · ' + e + '\n')
  console.error('  Comprobación manual: servir .output/public bajo el subpath, esperar a que el SW')
  console.error('  esté activo, MATAR el servidor y recargar. Si sale un 500, no hay offline.\n')
  process.exit(1)
}
console.log('✓ el offline se sostiene')

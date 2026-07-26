// vendor-fonts.mjs — Descarga las fuentes de Google Fonts a app/assets/fonts/ y genera fonts.css
// apuntando a los ficheros locales. Reemplaza ambos de forma reproducible: no editar a mano.
//
// Por qué self-host y no <link> a Google: la guía tiene que funcionar SIN COBERTURA (Mã Pí Lèng,
// Đồng Văn). Vendorizadas, Vite las sirve bajo /guiaJapon/_nuxt/ → cero peticiones a
// fonts.gstatic.com en runtime.
//
// Se conserva el UA de Chrome de guiaRoma: Google sirve instancias VARIABLES a Chromium y
// estáticas a otros agentes, y las variables son las buenas. (En guiaRoma esto además era
// paridad-pixel contra un golden; aquí no hay golden, pero la fuente sigue siendo la correcta.)
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const CSS2_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap'
// UA de Chrome real → Google sirve los MISMOS woff2 que ve Chromium al capturar el golden.
const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const FONTS_DIR = join(process.cwd(), 'app/assets/fonts')
const CSS_OUT = join(process.cwd(), 'app/assets/css/fonts.css')
// Subsets que el contenido usa.
//
// SUBSETS. `latin-ext` NO es opcional: los macrones del romaji (ō, ū de Tōkyō, Kyōto, Kamikōchi,
// Chūbu) viven en U+0100-017F, que solo cubre ese subset. Con solo `latin` caerían a la fuente del
// sistema a media palabra, sin error visible — un fallback silencioso.
//
// Nota de la bifurcación: guiaVietnam llevaba además el subset `vietnamese` (U+1EA0-1EF9) porque
// Google deja un agujero entre `latin-ext` (…U+1E00-1E9F, U+1EF2-1EFF…) y ese rango, y ahí viven
// las vocales tonales que partían "Đồng Văn" o "phở". En japonés no hace falta ninguna de ellas:
// se han quitado las 14 caras. Lo vigila tests/unit/fontsMacrones.spec.ts, en los dos sentidos
// (que latin-ext esté, y que el subset vietnamita no vuelva).
const KEEP_SUBSETS = new Set(['latin', 'latin-ext'])

const slug = s => s.toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '-')

const css = await (await fetch(CSS2_URL, { headers: { 'User-Agent': CHROME_UA } })).text()

// Limpia woff2 Lora/Cormorant/JetBrains previos (re-vendor reproducible).
for (const f of readdirSync(FONTS_DIR)) if (f.endsWith('.woff2')) unlinkSync(join(FONTS_DIR, f))
mkdirSync(FONTS_DIR, { recursive: true })

// Cada bloque va precedido de un comentario /* subset */.
const blocks = css.split('/*').slice(1) // [ "subset */ @font-face{...}", ... ]
const out = ['/* fonts.css — GENERADO por scripts/vendor-fonts.mjs. NO editar a mano: regenerar con',
  ' * `node scripts/vendor-fonts.mjs`. Self-hosted bajo /guiaJapon/_nuxt/ por Vite → cero peticiones',
  ' * a fonts.gstatic.com en runtime (la guía debe funcionar sin cobertura).',
  ' *',
  ' * Incluye el subset `vietnamese` (U+1EA0-1EF9): sin él, ồ/ạ/ở/ộ/ả caen a la fuente del sistema',
  ' * a media palabra y "Đồng Văn" se lee con las letras bailando. Ver el comentario del script. */', '']

let count = 0
for (const blk of blocks) {
  const subsetLabel = blk.slice(0, blk.indexOf('*/')).trim()
  if (!KEEP_SUBSETS.has(subsetLabel)) continue
  const face = blk.slice(blk.indexOf('*/') + 2)
  const family = (face.match(/font-family:\s*'([^']+)'/) || [])[1]
  const style = (face.match(/font-style:\s*(\w+)/) || [])[1]
  const weight = (face.match(/font-weight:\s*(\d+)/) || [])[1]
  const range = (face.match(/unicode-range:\s*([^;]+);/) || [])[1]
  const url = (face.match(/url\(([^)]+)\)\s*format\('woff2'\)/) || [])[1]
  if (!family || !url) continue
  const name = `${slug(family)}-${weight}-${style}-${subsetLabel}.woff2`
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': CHROME_UA } })).arrayBuffer())
  writeFileSync(join(FONTS_DIR, name), buf)
  out.push(`/* ${family} ${weight} ${style} ${subsetLabel} */`)
  out.push('@font-face {')
  out.push(`  font-family: '${family}';`)
  out.push(`  font-style: ${style};`)
  out.push(`  font-weight: ${weight};`)
  out.push('  font-display: swap;')
  out.push(`  src: url('~/assets/fonts/${name}') format('woff2');`)
  out.push(`  unicode-range: ${range.trim()};`)
  out.push('}')
  out.push('')
  count++
  console.log(`vendored ${name} (${buf.length} B)`)
}
writeFileSync(CSS_OUT, out.join('\n'))
console.log(`\n${count} @font-face vendored → ${CSS_OUT}`)

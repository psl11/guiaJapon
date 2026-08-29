// Presupuesto de peso para CI. Corre DESPUÉS de `nuxi generate` (necesita .output/public).
// Guarda justo las métricas que el dueño vigila y que crecen con el contenido/fotos:
//   · la descarga OFFLINE de fotos (precache del PWA para el loop de Hà Giang), y una foto suelta
//     sin optimizar (regresión típica: alguien mete un webp de 2 MB y el build seguiría verde);
//   · el _payload.json comprimido — el mayor activo de la primera carga online (contenido).
// Los umbrales llevan holgura para el crecimiento normal (más fichas/fotos) pero cazan una regresión
// real. Si algún día se justifica, se suben aquí a conciencia, no por sorpresa.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
const MB = 1024 * 1024

const BUDGET = {
  maxImage: 500 * KB, // una sola foto sin optimizar dispara esto (hoy la mayor ~333 KB)
  totalImg: 15 * MB, // descarga offline de fotos (hoy ~7,7 MB → holgura para ~doblar)
  // Subido de 550 a 900 KB (ago 2026) para que quepa la capa de «Recomendados por el grupo»: unos
  // doscientos hallazgos compartidos por el grupo que entran primero enteros y se filtran después.
  // El techo NO es decorativo — el payload es lo que se descarga en la primera carga online — así
  // que cuando termine el filtrado hay que volver a bajarlo a la holgura real, no dejarlo aquí.
  payloadGz: 900 * KB, // _payload.json comprimido (534 KB al subir el techo)
}

const fails = []
const notes = []

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

// 1) Imágenes en public/img (fuente commiteada) — peso total + la mayor suelta.
const imgDir = 'public/img'
if (existsSync(imgDir)) {
  const imgs = walk(imgDir).filter(f => /\.(webp|png|jpe?g)$/i.test(f))
  let total = 0
  let biggest = { f: '', s: 0 }
  for (const f of imgs) {
    const s = statSync(f).size
    total += s
    if (s > biggest.s) biggest = { f, s }
    if (s > BUDGET.maxImage) fails.push(`Imagen ${f} = ${(s / KB).toFixed(0)} KB > ${BUDGET.maxImage / KB} KB (¿sin optimizar?)`)
  }
  notes.push(`${imgs.length} imágenes · total ${(total / MB).toFixed(1)} MB · mayor ${(biggest.s / KB).toFixed(0)} KB (${biggest.f})`)
  if (total > BUDGET.totalImg) fails.push(`Total imágenes ${(total / MB).toFixed(1)} MB > ${BUDGET.totalImg / MB} MB`)
}

// 2) _payload.json comprimido (contenido de la ruta única; crece lineal con fichas/platos/días).
const payload = '.output/public/_payload.json'
if (existsSync(payload)) {
  const gz = gzipSync(readFileSync(payload)).length
  notes.push(`_payload.json ${(gz / KB).toFixed(0)} KB gzip`)
  if (gz > BUDGET.payloadGz) fails.push(`_payload.json ${(gz / KB).toFixed(0)} KB gzip > ${BUDGET.payloadGz / KB} KB (¿contenido inflado?)`)
} else {
  notes.push('(_payload.json no encontrado — ¿corriste tras `nuxi generate`?)')
}

console.log('Presupuesto de peso:')
for (const n of notes) console.log('  ·', n)
if (fails.length) {
  console.error('\n❌ PRESUPUESTO SUPERADO:')
  for (const f of fails) console.error('  ·', f)
  process.exit(1)
}
console.log('✓ dentro de presupuesto')

// PASO 4 (opcional) — Hoja de revisión manual.
// Saca a Markdown lo que la cascada de texto no resolvió, con el enlace al post y el
// caption recortado, para completarlo a mano sin abrir cien pestañas a ciegas.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATA } from './session.mjs'

const DM = process.argv.includes('--dm')
const pre = DM ? 'dm-' : ''
const modo = (process.argv[2] ?? 'pendientes').replace(/^--.*/, 'pendientes')
const file = join(DATA, `${pre}${modo === 'revisar' ? 'sitios' : 'pendientes'}.json`)
if (!existsSync(file)) {
  console.error(`  Falta ${file}. Lanza antes: npm run identify${DM ? ':dm' : ''}`)
  process.exit(1)
}

let fichas = JSON.parse(readFileSync(file, 'utf8'))
if (modo === 'revisar') fichas = fichas.filter(f => f.confianza && f.confianza !== 'alta')

const recorte = s => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 220)
const salida = join(DATA, `${pre}revision-${modo}.md`)

const cuerpo = fichas.map((f, i) => `
### ${i + 1}. \`${f.code}\`${f.nombre ? ` — propuesta: **${f.nombre}** _(${f.metodo}, ${f.confianza})_` : ''}

- **post:** ${f.reelUrl ?? f.url}
- **autor:** ${f.autor ? `@${f.autor}` : '—'}${f.fecha ? ` · publicado ${f.fecha}` : ''} · ${f.tipo}
${f.compartidoEl ? `- **compartido en el chat:** ${f.compartidoEl}${f.remitente ? ` por ${f.remitente}` : ''}${f.hidratado === false ? ' · ⚠️ llegó sin caption (xma), no se pudo rehidratar' : ''}\n` : ''}${f.pistaXma ? `- **pista de la tarjeta:** ${recorte(f.pistaXma)}\n` : ''}
${f.ubicacion?.name ? `- **ubicación IG:** ${f.ubicacion.name}${f.ubicacion.city ? ` (${f.ubicacion.city})` : ''}\n` : ''}${f.cuentasCandidatas.length ? `- **cuentas mencionadas:** ${f.cuentasCandidatas.map(c => `@${c}`).join(', ')}\n` : ''}${f.hashtags.length ? `- **hashtags:** ${f.hashtags.slice(0, 12).join(' · ')}\n` : ''}- **texto:** ${recorte(f.caption) || '_(sin caption)_'}

> NOMBRE: <!-- escribe aquí -->
> CIUDAD: <!-- Tokio / Kioto / ... -->
> DESCARTAR: <!-- pon x si no es un sitio de comida -->
`).join('\n---')

writeFileSync(salida, `# Revisión manual — ${modo} (${fichas.length})

Rellena las líneas \`NOMBRE:\` y \`CIUDAD:\`. Lo que no sea un local, marca \`DESCARTAR: x\`.
${cuerpo}
`)

console.log(`
  ${fichas.length} fichas → ${salida}
`)

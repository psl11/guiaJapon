// PASO 1 bis — Entrada del volcado hecho desde la consola del navegador.
// Coge el ig-guardados.json que descargó console-dump.js y lo mete en la base.
// Es acumulativo: puedes importar varios volcados y no se pisan.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { DATA } from './session.mjs'

const ruta = process.argv[2] ?? join(homedir(), 'Downloads', 'ig-guardados.json')
if (!existsSync(ruta)) {
  console.error(`
  No encuentro ${ruta}

  Uso: npm run import -- /ruta/al/ig-guardados.json
  (sin argumento busca en ~/Downloads/ig-guardados.json)
`)
  process.exit(1)
}

mkdirSync(DATA, { recursive: true })
const MEDIA = join(DATA, 'media.json')
const ORIGEN = join(DATA, 'origen.json')

const volcado = JSON.parse(readFileSync(ruta, 'utf8'))
const entrante = volcado.media ?? volcado          // acepta el objeto completo o solo el mapa
const media = existsSync(MEDIA) ? JSON.parse(readFileSync(MEDIA, 'utf8')) : {}
const origen = existsSync(ORIGEN) ? JSON.parse(readFileSync(ORIGEN, 'utf8')) : {}

const antes = Object.keys(media).length
Object.assign(media, entrante)
Object.assign(origen, volcado.origen ?? {})

writeFileSync(MEDIA, JSON.stringify(media, null, 2))
writeFileSync(ORIGEN, JSON.stringify(origen, null, 2))

const cols = volcado.colecciones ?? []
console.log(`
  Importado ${ruta}
    en la base antes ..... ${antes}
    nuevos ............... ${Object.keys(media).length - antes}
    total ................ ${Object.keys(media).length}
${cols.length ? `    colecciones .......... ${cols.map(c => c.nombre).join(' · ')}\n` : ''}
  Siguiente: npm run parse && npm run identify
`)

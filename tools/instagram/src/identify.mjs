// PASO 3 — Identificar y contar.
// Cascada de señales, de la más fiable a la más floja. Cada post se queda con el primer
// método que acierta y guarda cuál fue, para poder auditar después de dónde salió cada
// nombre. Lo que no cae por ninguna vía va a la cola de OCR/manual: ese es el número que
// interesa hoy — cuántos vamos a tener que mirar a mano.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATA } from './session.mjs'

// Con `--dm` la fuente es la conversación, no los guardados, y aparecen dos cosas que en una
// rejilla de guardados no existen: la fecha en que llegó cada post al chat y quién lo mandó.
// Sobre la primera se corta (`--dias`); sobre la segunda se filtra (`--de alba`), porque en un
// chat la mitad de lo compartido lo mandaste tú.
const DM = process.argv.includes('--dm')
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def }
const DIAS = Number(arg('dias', 15))
const DE = (arg('de', '') || '').toLowerCase()

const POSTS = join(DATA, DM ? 'dm-posts.json' : 'posts.json')
const pre = DM ? 'dm-' : ''
if (!existsSync(POSTS)) {
  console.error(`  No hay ${POSTS}. Lanza antes: npm run parse${DM ? ':dm' : ''}`)
  process.exit(1)
}

// Topónimos: si la ubicación etiquetada es esto, es una ZONA, no un local.
const ZONAS = new Set(['japan', 'japon', 'japón', 'nippon', 'nihon', '日本', 'tokyo', 'tokio', '東京', 'tokyo japan', 'kyoto', 'kioto', '京都', 'osaka', 'ōsaka', '大阪', 'hiroshima', 'nara', 'kanazawa', 'takayama', 'hakone', 'nikko', 'nikkō', 'kamakura', 'yokohama', 'kobe', 'kōbe', 'sapporo', 'fukuoka', 'shibuya', 'shinjuku', 'ginza', 'asakusa', 'akihabara', 'harajuku', 'ueno', 'ebisu', 'nakameguro', 'meguro', 'daikanyama', 'roppongi', 'shimokitazawa', 'koenji', 'kōenji', 'yanaka', 'tsukiji', 'toyosu', 'gion', 'arashiyama', 'pontocho', 'ponto-chō', 'dotonbori', 'dōtonbori', 'namba', 'umeda', 'shinsekai'])

const CIUDADES_JP = ['tokyo', 'tokio', 'kyoto', 'kioto', 'osaka', 'hiroshima', 'nara', 'kanazawa', 'takayama', 'hakone', 'nikko', 'kamakura', 'yokohama', 'kobe', 'sapporo', 'fukuoka', 'nagoya', 'miyajima', 'matsumoto', 'kamikochi', 'shirakawa']
const HASHTAGS_JP = /japan|japon|japón|tokyo|tokio|kyoto|kioto|osaka|nippon|nihon|japanese|japonesa|japones|japonés|ramen|sushi|izakaya|omakase|onsen|wagyu|yakitori|matcha|kissaten|tempura|udon|soba|okonomiyaki|takoyaki|gyoza|shibuya|shinjuku|ginza|asakusa/i
const PIN = /(?:📍|📌|🏠|🏮|🍽️?|🥢|➡️|▶️|🔖)/u
const KANA = /[぀-ヿ]/
const CJK = /[一-鿿]/
// Frases de gancho: si aparecen, la línea es una promesa, no un nombre.
const GANCHO = /\b(mejor|mejores|brutal|nivel|incre(i|í)ble|espectacular|guarda|guardad|imprescindible|obligado|flipar|locura|delicia|buen(i|í)simo|barato|caro|dios|no te|tienes? que|hay que|as(i|í) es|esto es|te va|os va|para tu|antes de|cu(a|á)nto|d(o|ó)nde|best|amazing|insane|must|save this|you need|i found|this is)\b/i

const norm = s => (s ?? '').toLowerCase().replace(/[·,.\-–—()]/g, ' ').replace(/\s+/g, ' ').trim()
const esZona = s => ZONAS.has(norm(s)) || ZONAS.has(norm(s).replace(/\s+japan$/, ''))

function limpiar (s) {
  return (s ?? '')
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}]/gu, '')
    .replace(/^[\s|·•\-–—:>»→~*_"'"'()\[\]]+|[\s|·•\-–—:>»→~*_"'"'()\[\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ¿Este post es de Japón? Coordenadas primero: es la única señal que no miente.
function esJapon (p) {
  const razones = []
  const { lat, lng } = p.ubicacion ?? {}
  if (typeof lat === 'number' && typeof lng === 'number') {
    if (lat > 24 && lat < 46 && lng > 122 && lng < 146) razones.push('coordenadas')
    else return { japon: false, razones: ['coordenadas fuera de Japón'] }
  }
  const geo = norm(`${p.ubicacion?.name ?? ''} ${p.ubicacion?.city ?? ''} ${p.ubicacion?.address ?? ''}`)
  if (/japan|japón|japon/.test(geo) || CIUDADES_JP.some(c => geo.includes(c))) razones.push('ubicación')
  if (p.hashtags.some(h => HASHTAGS_JP.test(h))) razones.push('hashtag')
  if (KANA.test(p.caption)) razones.push('kana en el texto')
  else if (CJK.test(p.caption) && razones.length) razones.push('kanji')
  const texto = norm(p.caption)
  if (CIUDADES_JP.some(c => texto.includes(c)) || /\bjap(o|ó)n\b|\bjapan\b/.test(texto)) razones.push('topónimo en el texto')
  return { japon: razones.length > 0, razones }
}

// La cascada. Devuelve el primer acierto.
function identificar (p) {
  const cap = p.caption ?? ''

  // 1 · Ubicación etiquetada por el autor. Es la señal fuerte: viene de la base de datos
  //     de sitios de Instagram, así que trae nombre real y coordenadas.
  const loc = p.ubicacion?.name
  if (loc && !esZona(loc)) return { nombre: limpiar(loc), metodo: 'ubicación', confianza: 'alta' }

  // 2 · Nombre entre comillas japonesas 「」『』 — casi siempre es el local.
  const jp = cap.match(/[「『]([^」』\n]{2,40})[」』]/)
  if (jp) return { nombre: limpiar(jp[1]), metodo: 'comillas 「」', confianza: 'alta' }

  // 3 · Chincheta. La convención de los reels de comida: 📍 Nombre del sitio.
  //     Puede ir a principio de línea, a mitad («Tonkatsu brutal 📍 Tonki») o con el
  //     nombre en la línea siguiente, así que se prueban las tres.
  const lineas = cap.split('\n')
  for (let i = 0; i < lineas.length; i++) {
    const pos = lineas[i].search(PIN)
    if (pos < 0) continue
    const tras = limpiar(lineas[i].slice(pos).replace(PIN, ''))
    const siguiente = limpiar(lineas[i + 1] ?? '')
    for (const cand of [tras, siguiente]) {
      if (cand.length >= 2 && cand.length <= 60 && !esZona(cand)) {
        return { nombre: cand, metodo: 'chincheta 📍', confianza: 'alta' }
      }
    }
  }

  // 4 · «Nombre: X» / «Sitio: X» / «Restaurante: X»
  const etiqueta = cap.match(/^[^\S\n]*(?:nombre|sitio|local|restaurante|lugar|name|spot|place|店名)[^\S\n]*[:：][^\S\n]*(.+)$/imu)
  if (etiqueta) {
    const n = limpiar(etiqueta[1])
    if (n.length >= 2 && n.length <= 60) return { nombre: n, metodo: 'etiqueta en el texto', confianza: 'alta' }
  }

  // 5 · Cuenta mencionada o etiquetada distinta del autor: suele ser la del propio local.
  //     Con una sola candidata es fiable; con varias, no se elige a ciegas.
  const cuentas = [...new Set([...p.menciones, ...p.etiquetados])]
    .filter(u => u && u.toLowerCase() !== (p.autor ?? '').toLowerCase())
    .filter(u => !/^(reels?|explore|instagram|threads)$/i.test(u))
  if (cuentas.length === 1) return { nombre: `@${cuentas[0]}`, metodo: 'cuenta mencionada', confianza: 'media', cuentas }
  if (cuentas.length > 1) return { nombre: null, metodo: null, confianza: null, cuentas, pista: 'varias cuentas mencionadas' }

  // 6 · Primera línea corta del caption. Flojo, pero acierta en los reels que abren con
  //     el nombre a pelo. Se descartan las frases de gancho («el mejor ramen de Tokio»),
  //     que es lo que ensuciaba este método: un nombre no lleva adjetivos ni verbos.
  const primera = limpiar(cap.split('\n').find(l => limpiar(l).length >= 3) ?? '')
  if (primera && primera.length <= 40 && primera.split(' ').length <= 4 &&
      !/[.!?]$/.test(primera) && !GANCHO.test(primera) && !esZona(primera)) {
    return { nombre: primera, metodo: 'primera línea', confianza: 'baja' }
  }

  return { nombre: null, metodo: null, confianza: null }
}

const todos = JSON.parse(readFileSync(POSTS, 'utf8'))

// ── El corte ──────────────────────────────────────────────────────────────────
// La hipótesis de partida es de Pablo: lo compartido en los últimos N días es del viaje a
// Japón; lo de más atrás es ruido del chat de siempre. No se aplica a ciegas — abajo se
// imprime la cronología para poder mover el corte con los datos delante en vez de a ojo.
const DIA_MS = 86_400_000
const corteMs = Date.now() - DIAS * DIA_MS
const enVentana = p => !DM || (p.compartidoMs ? p.compartidoMs >= corteMs : false)
// Se compara contra el usuario Y el nombre: en el chat de Alba el username es `almart__`, así que
// `--de alba` no casaría con él y devolvería cero sin decir por qué.
const delRemitente = p => !DE || [p.remitente, p.remitenteNombre].some(v => (v ?? '').toLowerCase().includes(DE))

const posts = todos.filter(p => enVentana(p) && delRemitente(p))

// Un post que llegó como tarjeta `xma` y no se pudo rehidratar no tiene caption, y sin caption
// ni esJapon() ni la cascada tienen nada que morder. Lo poco que trae el envoltorio —el título
// de la tarjeta, que suele ser el @ de la cuenta— se le pasa COMO SI fuera el caption: es una
// pista floja, pero la alternativa era tirarlo. Lo que salga de ahí baja a confianza 'baja'.
const conPista = p => (!p.caption?.trim() && p.pistaXma) ? { ...p, caption: p.pistaXma } : p

const fichas = posts.map(raw => {
  const p = conPista(raw)
  const soloPista = p !== raw
  const geo = esJapon(p)
  const id = identificar(p)
  if (soloPista && id.nombre) { id.confianza = 'baja'; id.metodo = `${id.metodo} · tarjeta xma` }
  return {
    ...raw,
    soloPista,
    japon: geo.japon,
    japonPorque: geo.razones,
    nombre: id.nombre ?? null,
    metodo: id.metodo ?? null,
    confianza: id.confianza ?? null,
    cuentasCandidatas: id.cuentas ?? [],
    pista: id.pista ?? null,
    // Etiqueta de autoría del hallazgo, que es lo que pediste para separarlo de lo de Pablo.
    fuente: 'alba',
    estado: id.nombre ? (id.confianza === 'alta' ? 'auto' : 'revisar') : 'pendiente',
  }
})

// Los que llegaron vacíos NO se descartan aunque no den señales de Japón: un post del que no
// sabemos nada no es un post que sepamos que no es de Japón. Van a la cola de revisión, que es
// donde se miran con el ojo. Confundir las dos cosas es la forma silenciosa de perder sitios.
const aOscuras = fichas.filter(f => f.hidratado === false && !f.japon)
const jp = fichas.filter(f => f.japon)
const noJp = fichas.filter(f => !f.japon && f.hidratado !== false)
const identificados = jp.filter(f => f.nombre)
const pendientes = [...jp.filter(f => !f.nombre), ...aOscuras]

writeFileSync(join(DATA, `${pre}sitios.json`), JSON.stringify(jp, null, 2))
writeFileSync(join(DATA, `${pre}descartados.json`), JSON.stringify(noJp, null, 2))
writeFileSync(join(DATA, `${pre}pendientes.json`), JSON.stringify(pendientes, null, 2))

const cuenta = (arr, key) => arr.reduce((acc, f) => { const k = f[key] ?? '—'; acc[k] = (acc[k] ?? 0) + 1; return acc }, {})
const tabla = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `      ${String(v).padStart(4)}  ${k}`).join('\n') || '      —'
const pct = (n, total) => total ? `${Math.round(n / total * 100)}%` : '—'

// ── La comprobación del corte ─────────────────────────────────────────────────
// La otra regla que propuso Pablo: ir hacia atrás y parar cuando cinco seguidos no sean de
// Japón. Aquí no decide nada —solo dice DÓNDE habría cortado ella—, para poder contrastarla
// con la de los 15 días antes de fiarse de ninguna de las dos.
function dondeCortaLaRacha (lista, racha = 5) {
  let seguidos = 0
  for (const [i, f] of lista.entries()) {
    if (f.japon) seguidos = 0
    else if (++seguidos >= racha) return { indice: i - racha + 1, fecha: lista[i - racha + 1]?.compartidoEl ?? null }
  }
  return null
}

let extra = ''
if (DM) {
  const orden = todos
    .filter(delRemitente)
    .map(p => ({ ...p, japon: esJapon(p).japon }))
    .sort((a, b) => (b.compartidoMs ?? 0) - (a.compartidoMs ?? 0))

  const porDia = orden.reduce((a, f) => {
    const d = f.compartidoEl ?? '—'
    a[d] ??= { total: 0, jp: 0 }
    a[d].total++
    if (f.japon) a[d].jp++
    return a
  }, {})

  const racha = dondeCortaLaRacha(orden)
  const cronologia = Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0])).map(([d, v]) => {
    const dentro = new Date(d).getTime() >= corteMs ? '│' : ' '
    const barra = '█'.repeat(Math.min(v.jp, 30)) + '·'.repeat(Math.min(v.total - v.jp, 30))
    return `      ${dentro} ${d}  ${String(v.jp).padStart(3)}/${String(v.total).padEnd(3)} ${barra}`
  }).join('\n')

  extra = `
  ══ CRONOLOGÍA DEL CHAT ══════════════════════════════════════════
     (│ = dentro de los ${DIAS} días · █ Japón · · resto)

${cronologia}

    corte por fecha (${DIAS} días) ..... ${new Date(corteMs).toISOString().slice(0, 10)}  → ${posts.length} posts
    corte por racha de 5 no-Japón .... ${racha ? `${racha.fecha}  → ${racha.indice} posts` : 'nunca se dispara'}
    sin rehidratar (sin caption) ..... ${posts.filter(p => p.hidratado === false).length}
`
}

console.log(`
  ══ ${DM ? `COMPARTIDO EN EL DM${DE ? ` POR «${DE}»` : ''} · últimos ${DIAS} días` : 'GUARDADOS DE INSTAGRAM'} ${'═'.repeat(Math.max(0, 20 - DIAS.toString().length))}

    en la ventana ................ ${fichas.length}${DM ? `   (de ${todos.length} en la base)` : ''}
    con señales de Japón ......... ${jp.length}   (${pct(jp.length, fichas.length)})
    descartados (no Japón) ....... ${noJp.length}
    a oscuras (llegaron vacíos) .. ${aOscuras.length}   → a la cola, no al descarte

  ══ DE LOS DE JAPÓN ══════════════════════════════════════════════

    nombre identificado .......... ${identificados.length}   (${pct(identificados.length, jp.length)})
    sin identificar → cola ....... ${pendientes.length}   (${jp.filter(f => !f.nombre).length} de Japón sin nombre + ${aOscuras.length} a oscuras)

    por método:
${tabla(cuenta(identificados, 'metodo'))}

    por confianza:
${tabla(cuenta(identificados, 'confianza'))}
${extra}
  ══ LA COLA ══════════════════════════════════════════════════════

    de los ${pendientes.length} sin identificar:
      ${pendientes.filter(p => p.esReel).length} son vídeo  → candidatos a OCR de frames
      ${pendientes.filter(p => !p.esReel).length} son imagen → candidatos a OCR de la foto
      ${pendientes.filter(p => p.cuentasCandidatas.length > 1).length} tienen varias cuentas mencionadas → desambiguar

  Ficheros: data/${pre}sitios.json · data/${pre}pendientes.json · data/${pre}descartados.json
`)

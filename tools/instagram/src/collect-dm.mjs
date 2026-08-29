// PASO 1 · variante DM — los elementos compartidos dentro de una conversación privada.
//
// POR QUÉ UN SCRIPT APARTE de collect.mjs, que ya baja por una rejilla de guardados: en un chat
// lo que importa no es el post, es EL MENSAJE QUE LO TRAE. El post lleva su propia fecha —cuándo
// lo publicó su autor, que puede ser de hace tres años— y esa fecha no sirve para nada aquí. La
// que ordena esto es CUÁNDO SE COMPARTIÓ, y solo vive en el envoltorio del mensaje (`timestamp`,
// en microsegundos). collect.mjs tira el envoltorio y se queda con el media: perdería justo el
// único dato sobre el que se puede cortar.
//
// Segundo motivo: en un DM los posts no llegan todos con el objeto completo. Instagram tiene dos
// formas de meter un post en un chat y son muy desiguales:
//   · `media_share` / `clip` → el objeto entero, con caption, hashtags y ubicación. Regalado.
//   · `xma_*` (el formato nuevo) → una tarjeta de preview y poco más: a menudo SIN caption, que
//     es de donde sale el nombre del sitio. Lo único aprovechable es el `target_url`.
// Por eso hay una segunda fase que rehidrata los pelados visitando su propia página.
//
// ── LOS TRES MODOS, Y POR QUÉ EL BUENO ES `--api` ────────────────────────────────────────────
// `--api` (el que se usa) le pide el hilo paginado a la API interna DESDE DENTRO de la pestaña
// ya logueada. Cincuenta mensajes por petición, cursor a cursor, historial completo y sin que
// nadie arrastre nada. Es determinista: o responde o da error, no depende de acertar con un
// contenedor virtualizado.
//
// Las otras dos existen porque se probaron primero y fallaron, y conviene que quede escrito:
//   · autoscroll (por defecto) — la rueda simulada sobre la rejilla de mensajes.
//   · `--pasivo` — escuchar mientras un humano sube a mano.
// Las dos dependen de INTERCEPTAR la red, y ahí está la trampa que costó la tarde: el mensajero
// nuevo de Instagram no habla por `/api/v1/…` ni por `/graphql`, sino por **`/api/graphql`**, que
// el filtro de URL original no cogía —pedía `api/v1` o `graphql` pegados al host—. Con el hilo
// abierto delante se veían CERO respuestas y parecía que no había tráfico. Además esas respuestas
// llegan a veces como NDJSON o con el prefijo anti-hijacking `for (;;);`, y `res.json()` revienta
// en silencio con las dos. Las dos cosas están arregladas abajo, pero aun así `--api` es mejor.
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { openBrowser, isLoggedIn, DATA } from './session.mjs'

const RAW = join(DATA, 'raw')
const ITEMS = join(DATA, 'dm-items.json')
const DMMEDIA = join(DATA, 'dm-media.json')
const HILOS = join(DATA, 'dm-hilos.json')
const LISTO = join(DATA, 'LISTO')

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}
const num = (name, def) => Number(arg(name, def))

// `--dias` es la ventana que interesa; `--margen` lo que se baja DE MÁS por debajo de ella. El
// margen no es capricho: la regla de parada alternativa («cuando cinco seguidos no sean de Japón,
// corta») solo se puede evaluar con posts por debajo del corte ya en la mano.
const DIAS = num('dias', 15)
const MARGEN = num('margen', 20)
const SIN_HIDRATAR = process.argv.includes('--sin-hidratar')
const PASIVO = process.argv.includes('--pasivo')
const API = process.argv.includes('--api')
const DEBUG = process.argv.includes('--debug')
// Volcado forense: guarda el cuerpo crudo de cada respuesta a data/raw/debug/. Se enciende solo
// cuando hay que aprender un esquema nuevo — que es exactamente lo que pasó con el mensajero:
// las respuestas llegaban, traían los posts, y aun así no se reconocía ni un mensaje dentro.
const VOLCAR = process.argv.includes('--volcar')
const MAX_PAGINAS = num('paginas', 120)
// El hilo, explícito. En un chat de dos, el número de instagram.com/direct/t/<n> ES el
// thread_fbid. Pasarlo evita la carrera de esperar a que un humano abra la conversación mientras
// la bandeja precarga peticiones de OTROS hilos — que es como se acabó paginando el chat
// equivocado la primera vez.
const HILO = arg('hilo', null)

const DIA_MS = 86_400_000
const corte = Date.now() - DIAS * DIA_MS
const suelo = Date.now() - (DIAS + MARGEN) * DIA_MS
const fecha = ms => new Date(ms).toISOString().slice(0, 10)
const log = msg => console.log(`${new Date().toTimeString().slice(0, 8)}  ${msg}`)
const espera = ms => new Promise(r => setTimeout(r, ms))

// ── Rastreo del JSON ──────────────────────────────────────────────────────────
function * walk (node) {
  if (!node || typeof node !== 'object') return
  yield node
  for (const value of Object.values(node)) if (value && typeof value === 'object') yield * walk(value)
}

const CODE = /^[A-Za-z0-9_-]{8,14}$/
const esMedia = n => 'media_type' in n || 'image_versions2' in n || 'display_url' in n ||
  'video_versions' in n || 'thumbnail_url' in n

// Instagram guarda los timestamps de DM en MICROsegundos (16 cifras) pero no siempre: los mismos
// campos aparecen en ms y en s según el endpoint. Se normaliza por magnitud, no por confianza.
function aMs (t) {
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n > 1e15) return Math.round(n / 1000)
  if (n > 1e12) return Math.round(n)
  if (n > 1e9) return Math.round(n * 1000)
  return null
}

// DOS ESQUEMAS CONVIVEN, y esto es lo que costó la tarde. El clásico —`item_id`, `item_type`,
// `timestamp` en microsegundos— es el que documenta todo el mundo y el que el hilo de Pablo ya no
// usa. El del mensajero nuevo cuelga de `get_slide_thread_nullable → as_ig_direct_thread →
// slide_messages.edges[].node` y renombra las tres claves: `message_id`, `content_type`,
// `timestamp_ms`. Buscar por la forma vieja daba CERO mensajes con el hilo abierto delante.
// Se normalizan aquí a una forma común para que nada de aguas abajo tenga que saber cuál vino.
function cosecharItems (json) {
  const out = []
  for (const n of walk(json)) {
    if (Array.isArray(n)) continue
    if (typeof n.item_id === 'string' && typeof n.item_type === 'string' && n.timestamp) {
      out.push({ id: n.item_id, tipo: n.item_type, ms: aMs(n.timestamp), remitente: n.user_id, hilo: n.thread_id, texto: typeof n.text === 'string' ? n.text : null, nodo: n })
    } else if (typeof n.message_id === 'string' && n.timestamp_ms) {
      out.push({ id: n.message_id, tipo: n.content_type ?? 'desconocido', ms: aMs(n.timestamp_ms), remitente: n.sender_fbid ?? n.sender?.id ?? null, hilo: n.thread_fbid ?? null, texto: typeof n.text_body === 'string' ? n.text_body : null, nodo: n })
    }
  }
  return out
}

// El xma del mensajero trae MÁS de lo que aparenta: `title_text` es el caption ENTERO del post,
// precedido del nombre de la cuenta, y `header_title_text` es esa cuenta. Con eso la cascada de
// identificación tiene todo lo que necesita —chincheta, comillas japonesas, hashtags, menciones—
// y la fase de rehidratado deja de ser necesaria para la mayoría. Se fabrica un objeto con la
// forma del media clásico para que parse.mjs no tenga que aprender un segundo camino.
function mediaDesdeXma (nodo, code) {
  const xma = nodo?.content?.xma
  if (!xma) return null
  const autor = xma.header_title_text ?? null
  let texto = xma.title_text ?? xma.xmaTitle ?? ''
  // El `id` del target_url es `<pk>_<usuario>`, que es justo lo que come /api/v1/media/<id>/info/.
  // Es la llave para rehidratar sin abrir una página por post: el xma trae el caption VACÍO en la
  // mayoría de los reels compartidos, así que sin esto se quedan en un shortcode y nada más.
  let pk = xma.target_id ?? null
  try {
    const q = new URL(xma.target_url ?? '', 'https://www.instagram.com').searchParams.get('id')
    if (q) pk = q
  } catch { /* target_url ausente o roto */ }
  // Viene como «usuario caption entero». Quitarle el prefijo importa: sin ello la «primera línea
  // corta» de la cascada devolvería siempre el nombre de la cuenta en vez del del local.
  if (autor && texto.startsWith(autor)) texto = texto.slice(autor.length).trimStart()
  const esReel = /\/reel(s)?\//.test(xma.target_url ?? '')
  const prev = xma.preview_image
  return {
    code,
    ...(esReel ? { media_type: 2, product_type: 'clips' } : {}),
    user: { username: autor },
    caption: { text: texto },
    ...(prev?.url ? { image_versions2: { candidates: [{ width: prev.width ?? 0, url: prev.url }] } } : {}),
    __deXma: true,
    __pk: pk,
    // Marca para la fase 2: el xma no traía texto, así que esta ficha es un cascarón.
    __sinCaption: !texto.trim(),
  }
}

// Los shortcodes de un item, vengan como objeto completo o como simple enlace.
function extraer (item) {
  const medias = []
  const codes = new Set()
  for (const n of walk(item)) {
    if (Array.isArray(n)) continue
    const code = n.code ?? n.shortcode
    if (typeof code === 'string' && CODE.test(code) && esMedia(n)) { medias.push({ code, node: n }); codes.add(code) }
    // La vía de los `xma_*`: no traen media, solo un enlace. A veces envuelto en el redirector
    // l.instagram.com con la URL real percent-encodeada dentro, así que se decodifica antes.
    for (const k of ['target_url', 'url', 'link_url', 'permalink', 'preview_url']) {
      const v = n[k]
      if (typeof v !== 'string') continue
      let s = v
      try { s = decodeURIComponent(v) } catch { /* URL mal formada: se mira tal cual */ }
      const m = s.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{8,14})/)
      if (m) codes.add(m[1])
    }
  }
  return { medias, codes: [...codes] }
}

// ── Estado ────────────────────────────────────────────────────────────────────
const items = existsSync(ITEMS) ? JSON.parse(readFileSync(ITEMS, 'utf8')) : {}
const media = existsSync(DMMEDIA) ? JSON.parse(readFileSync(DMMEDIA, 'utf8')) : {}
const hilos = existsSync(HILOS) ? JSON.parse(readFileSync(HILOS, 'utf8')) : {}
const arranque = Object.keys(items).length
const payloads = []
let volcados = 0
let pedidos = 0

// Todo lo que entra —sea de la API o de una respuesta interceptada— pasa por aquí. Una sola
// puerta: si mañana hay una tercera vía de entrada, no hay que reimplementar el reparto.
function procesar (json, origen = '?') {
  for (const n of walk(json)) {
    if (Array.isArray(n)) continue
    const idHilo = typeof n.thread_id === 'string' ? n.thread_id : (typeof n.thread_fbid === 'string' ? n.thread_fbid : null)
    if (idHilo && Array.isArray(n.users)) {
      hilos[idHilo] = {
        titulo: n.thread_title ?? null,
        usuarios: n.users.map(u => ({ pk: String(u.pk ?? u.pk_id ?? u.id ?? ''), fbid: u.interop_messaging_user_fbid != null ? String(u.interop_messaging_user_fbid) : null, username: u.username ?? null, nombre: u.full_name ?? null })),
        yo: n.viewer_id != null ? String(n.viewer_id) : (hilos[idHilo]?.yo ?? null),
      }
    }
  }

  const encontrados = cosecharItems(json)
  if (!encontrados.length) {
    // Respuestas de la fase de rehidratado: no traen items, solo el media suelto.
    for (const n of walk(json)) {
      if (Array.isArray(n)) continue
      const code = n.code ?? n.shortcode
      if (typeof code === 'string' && CODE.test(code) && esMedia(n)) media[code] = n
    }
    return 0
  }

  payloads.push({ origen, json })
  for (const item of encontrados) {
    const { medias, codes } = extraer(item.nodo)
    for (const { code, node } of medias) media[code] = node
    // Si el mensaje no traía objeto media pero sí un xma con caption, se fabrica. Es la diferencia
    // entre 200 fichas identificables y 200 huérfanos con solo un shortcode.
    for (const code of codes) {
      if (media[code]) continue
      const fabricado = mediaDesdeXma(item.nodo, code)
      if (fabricado) media[code] = fabricado
    }
    items[item.id] = {
      itemId: item.id,
      tipo: item.tipo,
      ms: item.ms,
      compartidoEl: item.ms ? fecha(item.ms) : null,
      remitenteId: item.remitente != null ? String(item.remitente) : null,
      threadId: item.hilo ?? null,
      codes,
      texto: item.texto,
      // El nodo crudo SOLO cuando no se pudo sacar caption por ninguna vía: ahí el envoltorio
      // (header_title, subtitle) puede ser lo único que nombre al sitio.
      crudo: codes.some(c => media[c]?.caption?.text?.trim()) ? null : item.nodo,
    }
  }
  return encontrados.length
}

function guardar () {
  mkdirSync(RAW, { recursive: true })
  writeFileSync(ITEMS, JSON.stringify(items, null, 2))
  writeFileSync(DMMEDIA, JSON.stringify(media, null, 2))
  writeFileSync(HILOS, JSON.stringify(hilos, null, 2))
  if (payloads.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(RAW, `dm-${stamp}.json`), JSON.stringify(payloads, null, 2))
  }
}

const total = () => Object.keys(items).length
const conFecha = () => Object.values(items).filter(i => i.ms)
const masViejo = () => { const f = conFecha(); return f.length ? Math.min(...f.map(i => i.ms)) : null }

// ── Navegador ─────────────────────────────────────────────────────────────────
const ctx = await openBrowser()
let cerrado = false
ctx.on('close', () => { cerrado = true })

// Meta devuelve por el mismo tubo tres cosas distintas: JSON a secas, JSON con el prefijo
// anti-hijacking `for (;;);`, y NDJSON (varias respuestas GraphQL, una por línea, que es como
// viaja el mensajero nuevo). `res.json()` solo entiende la primera y falla callado con las otras.
function * trocear (text) {
  const limpio = text.replace(/^for\s*\(;;\);/, '').trim()
  if (!limpio) return
  try { yield JSON.parse(limpio); return } catch { /* será NDJSON */ }
  for (const linea of limpio.split('\n')) {
    const l = linea.trim()
    if (l.length < 2) continue
    try { yield JSON.parse(l) } catch { /* línea partida: se ignora */ }
  }
}

// La PLANTILLA de paginación. El mensajero nuevo no pide el hilo por una URL con parámetros sino
// con un POST a /api/graphql (doc_id + variables), así que no se puede construir la petición a
// mano sin conocer el doc_id de esta versión del cliente —que cambia cada semana—. Lo que sí se
// puede es coger LA QUE ACABA DE HACER LA PÁGINA y reemitirla cambiando solo el cursor.
let plantilla = null
ctx.on('request', req => {
  if (req.method() !== 'POST') return
  if (!/instagram\.com\/api\/graphql/.test(req.url())) return
  const body = req.postData() ?? ''
  if (!body) return
  // El nombre amistoso de la consulta es lo que identifica cuál de las treinta peticiones que
  // hace la página es la del hilo. No se adivina: se lee.
  const amistoso = (body.match(/fb_api_req_friendly_name=([^&]+)/) ?? [])[1] ?? ''
  if (VOLCAR) {
    const dir = join(RAW, 'req')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${String(pedidos++).padStart(3, '0')}-${decodeURIComponent(amistoso).replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.txt`), `${req.url()}\n\n${body}`)
  }
  // La firma NO es el nombre de la consulta —`IGDThreadDetailQuery` hoy, otra cosa el mes que
  // viene— sino lo que pide: unas variables con `thread_fbid` y un tamaño de página. Atarlo al
  // nombre ya falló una vez.
  if (/thread_fbid/.test(decodeURIComponent(body)) && /MessagePageCount/i.test(decodeURIComponent(body))) {
    plantilla = { url: req.url(), body, amistoso: decodeURIComponent(amistoso) }
  }
})

ctx.on('response', async res => {
  const url = res.url()
  // Ancho a propósito. El filtro estrecho de la primera versión —`api/v1` o `graphql` pegados al
  // host— dejaba fuera `/api/graphql`, que es justo por donde habla el mensajero. Es más barato
  // mirar de más y descartar por forma que adivinar la ruta de turno.
  if (!/(^|\/\/)(www\.)?instagram\.com\//.test(url)) return
  if (!/\/(api|graphql)\//.test(url)) return
  const ct = res.headers()['content-type'] ?? ''
  if (!/json|javascript|text\/plain/i.test(ct)) return
  let text
  try { text = await res.text() } catch { return }
  if (VOLCAR) {
    const dir = join(RAW, 'debug')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${String(volcados++).padStart(3, '0')}-${url.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.txt`), `${url}\n\n${text.slice(0, 4_000_000)}`)
  }
  let n = 0
  for (const json of trocear(text)) n += procesar(json, url)
  if (DEBUG) log(`   ← ${String(n).padStart(3)} items · ${url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*/, '')}`)
})

const page = ctx.pages()[0] ?? await ctx.newPage()
await page.goto(HILO ? `https://www.instagram.com/direct/t/${HILO}/` : 'https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded' }).catch(() => {})

if (!await isLoggedIn(ctx)) {
  log('Esperando a que inicies sesión en la ventana del navegador...')
  while (!cerrado && !await isLoggedIn(ctx)) await espera(2000)
}
if (cerrado) process.exit(0)
log('Sesión detectada.')
console.log(`   ventana que interesa .... desde ${fecha(corte)}  (${DIAS} días)
   se baja hasta ........... ${fecha(suelo)}  (+${MARGEN} de margen)
`)

const activa = () => { const p = ctx.pages(); return p[p.length - 1] }
const hiloDeUrl = u => (u.match(/\/direct\/t\/(\d+)/) ?? [])[1] ?? null

// ── Modo API · pedir el hilo paginado desde dentro de la pestaña ──────────────
if (API) {
  console.log(`
   ┌──────────────────────────────────────────────────────────────┐
   │  MODO API — no tienes que arrastrar nada.                    │
   │  Deja la conversación abierta; yo reemito su propia          │
   │  petición pidiendo páginas grandes.                          │
   └──────────────────────────────────────────────────────────────┘
`)
  // La petición del hilo la hace la página al cargar. Si aún no ha pasado por delante —porque la
  // pestaña lleva rato abierta— se fuerza recargando: es la forma barata de conseguir una
  // plantilla fresca con su `fb_dtsg` y su `doc_id` del día.
  let abierto = 0
  while (!cerrado && !hiloDeUrl(activa()?.url() ?? '') && abierto < 60) {
    if (abierto === 0) log('Esperando a que haya una conversación abierta...')
    await espera(1500); abierto++
  }
  let esperando = 0
  while (!cerrado && !plantilla && esperando < 40) {
    const p = activa()
    if (p && !p.isClosed() && hiloDeUrl(p.url()) && esperando === 6) {
      log('No he visto la petición del hilo. Recargo para provocarla...')
      await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    }
    if (esperando === 0) log('Esperando a que la página pida el hilo...')
    await espera(1500)
    esperando++
  }

  if (!plantilla) {
    log('No he podido capturar la petición del hilo. Prueba con --pasivo y sube a mano.')
  } else if (!cerrado) {
    const params = new URLSearchParams(plantilla.body)
    const vars = JSON.parse(params.get('variables') ?? '{}')
    const clavePagina = Object.keys(vars).find(k => /MessagePageCount/i.test(k))

    // EL HILO LO MANDA LA URL, NO LA PLANTILLA. La página precarga varias conversaciones al
    // abrir la bandeja, así que la primera petición que pasa por delante puede ser de cualquiera
    // — y de hecho lo fue: se paginó entero el chat de otra persona antes de darse cuenta. En un
    // chat de dos, el número de `/direct/t/<n>` ES el thread_fbid, así que se sobrescribe.
    const deUrl = hiloDeUrl(activa()?.url() ?? '')
    if (!deUrl) { log('No hay ninguna conversación abierta. Abre la de Alba y relanza.'); process.exit(1) }
    if (vars.thread_fbid && String(vars.thread_fbid) !== deUrl) {
      log(`La plantilla venía del hilo ${vars.thread_fbid}; la reapunto al de la URL (${deUrl}).`)
    }
    vars.thread_fbid = deUrl
    log(`Plantilla capturada · hilo ${deUrl} · doc_id ${params.get('doc_id')} · página actual ${clavePagina ? vars[clavePagina] : '?'}`)

    if (!clavePagina) {
      log('La consulta no lleva tamaño de página; no puedo agrandarla. Usa --pasivo.')
    } else {
      // No hay variable de cursor en esta consulta: el único mando es el TAMAÑO DE PÁGINA. Así que
      // se pide cada vez el doble, desde el principio del hilo, hasta que deje de crecer. Sale más
      // caro en bytes que un cursor, pero son ocho peticiones y no ochenta, y sobre todo no
      // depende de que alguien arrastre bien.
      let tam = 200
      let antes = -1
      for (let intento = 0; !cerrado && intento < 7; intento++) {
        vars[clavePagina] = tam
        params.set('variables', JSON.stringify(vars))
        const cuerpo = params.toString()
        const texto = await activa().evaluate(async body => {
          const r = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
            credentials: 'include',
          })
          return r.ok ? await r.text() : `__ERROR__ ${r.status}`
        }, cuerpo).catch(e => `__ERROR__ ${e}`)

        if (texto.startsWith('__ERROR__')) { log(`   página de ${tam}: ${texto}`); break }
        let hayMas = false
        for (const json of trocear(texto)) {
          procesar(json, `api:${tam}`)
          for (const n of walk(json)) {
            if (!Array.isArray(n) && n?.page_info?.has_next_page === true) hayMas = true
          }
        }
        const v = masViejo()
        log(`   pedidos ${tam} · ${total()} mensajes · ${Object.keys(media).length} posts · más antiguo ${v ? fecha(v) : '—'}${hayMas ? ' · hay más' : ''}`)
        guardar()
        if (total() === antes) { log('   deja de crecer: el hilo está entero.'); break }
        if (!hayMas && v && v < suelo) { log('   sin más páginas y por debajo del suelo.'); break }
        antes = total()
        tam *= 2
        await espera(1200)
      }
    }
  }
}

// ── Modo pasivo · escuchar mientras el humano sube ────────────────────────────
if (PASIVO && !API) {
  if (existsSync(LISTO)) rmSync(LISTO)   // una señal vieja dispararía el final antes de empezar
  console.log(`
   ┌──────────────────────────────────────────────────────────────┐
   │  MODO PASIVO — conduces tú. Sube por el chat a tu ritmo.     │
   │  Yo escucho y guardo cada pocos segundos.                    │
   └──────────────────────────────────────────────────────────────┘
`)
  log('Escuchando.')
  let ultimo = -1
  while (!cerrado && !existsSync(LISTO)) {
    await espera(3000)
    const n = total()
    if (n === ultimo) continue
    ultimo = n
    guardar()
    const v = masViejo()
    const dentro = Object.values(items).filter(i => i.ms && i.ms >= corte).length
    log(`   ${n} mensajes · ${Object.keys(media).length} posts · más antiguo: ${v ? fecha(v) : '—'} · ${dentro} en la ventana${v && v < suelo ? '  ← ya has pasado del suelo' : ''}`)
  }
  if (existsSync(LISTO)) { rmSync(LISTO); log('Señal recibida: dejo de escuchar.') }
}

// ── Modo autoscroll (por defecto) ─────────────────────────────────────────────
if (!API && !PASIVO) {
  let avisado = false
  while (!cerrado) {
    const p = activa()
    if (!p || p.isClosed()) { await espera(1500); continue }
    if (!hiloDeUrl(p.url())) {
      if (!avisado) { log('Esperando a que abras la conversación...'); avisado = true }
      await espera(1500)
      continue
    }
    const antes = total()
    log('Conversación detectada. Recargo para capturar el lote visible...')
    await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await espera(4000)
    const dims = await p.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })).catch(() => ({ w: 1400, h: 900 }))
    log('Subiendo por el historial. No toques el navegador.')
    let ultimo = -1
    let quieto = 0
    for (let v = 0; !cerrado && quieto < 8 && v < 800; v++) {
      if (p.isClosed() || !hiloDeUrl(p.url())) break
      // La rueda sobre el centro del panel, no scrollTop sobre un selector: el contenedor de
      // mensajes está virtualizado y cambia de clase, pero la rueda acaba en lo que hay debajo.
      await p.mouse.move(dims.w * 0.62, dims.h * 0.5).catch(() => {})
      await p.mouse.wheel(0, -900).catch(() => {})
      await espera(950)
      const n = total()
      if (n === ultimo) quieto++
      else { quieto = 0; ultimo = n; const vv = masViejo(); log(`   ${n} mensajes · más antiguo: ${vv ? fecha(vv) : '—'}`) }
      const vv = masViejo()
      if (vv && vv < suelo) { log(`Alcanzado ${fecha(suelo)}. Paro.`); break }
    }
    guardar()
    log(`Hilo listo: +${total() - antes} mensajes nuevos.`)
    break
  }
}

// ── Fase 2 · rehidratar los que llegaron pelados ──────────────────────────────
// Un `xma_media_share` no trae caption, y sin caption la cascada de identificación no tiene nada
// que morder. Visitando el post en el navegador ya logueado, la propia página pide su objeto
// completo y el interceptor de arriba lo recoge. Solo los de dentro de la ventana: rehidratar
// meses de historial no aporta y sí llama la atención.
if (!cerrado && !SIN_HIDRATAR) {
  // El xma del mensajero trae el caption VACÍO en la mayoría de los reels compartidos: solo el
  // nombre de la cuenta y el enlace. Sin caption la cascada no tiene de dónde sacar el nombre del
  // local, así que hay que ir a por él.
  //
  // NO se hace abriendo la página del reel —serían 300 cargas completas, lentísimas y muy
  // visibles—. El `target_url` del xma lleva `?id=<pk>_<usuario>`, y ese pk es lo que come
  // /api/v1/media/<id>/info/, que devuelve el objeto ENTERO: caption, hashtags, menciones,
  // usertags y la ubicación con coordenadas — que es justo la señal más fiable del filtro de
  // Japón y la que el xma no tiene. Una petición ligera por post, desde la propia pestaña.
  const dentro = Object.values(items).filter(i => i.ms && i.ms >= suelo)
  const faltan = [...new Set(dentro.flatMap(i => i.codes))]
    .filter(c => media[c] && !media[c].caption?.text?.trim() && media[c].__pk)
  const sinPk = [...new Set(dentro.flatMap(i => i.codes))].filter(c => media[c] && !media[c].caption?.text?.trim() && !media[c].__pk)

  if (faltan.length) {
    log(`Rehidratando ${faltan.length} posts por la API de media${sinPk.length ? ` (${sinPk.length} sin pk, se quedan fuera)` : ''}...`)
    const p = activa()
    let ok = 0
    let fallos = 0
    for (let i = 0; i < faltan.length && !cerrado; i += 1) {
      const code = faltan[i]
      const pk = media[code].__pk
      const texto = await p.evaluate(async pk => {
        const appId = (document.documentElement.innerHTML.match(/"(?:APP_ID|X-IG-App-ID)"\s*:\s*"(\d+)"/) ?? [])[1] ?? '936619743392459'
        try {
          const r = await fetch(`/api/v1/media/${pk}/info/`, { headers: { 'X-IG-App-ID': appId }, credentials: 'include' })
          return r.ok ? await r.text() : `__ERROR__ ${r.status}`
        } catch (e) { return `__ERROR__ ${e}` }
      }, pk).catch(e => `__ERROR__ ${e}`)

      if (texto.startsWith('__ERROR__')) {
        fallos++
        // Un 429 es Instagram diciendo «para». Seguir insistiendo es lo que hace que marquen la
        // cuenta, así que se corta y se guarda lo que haya: la fase es reanudable.
        if (texto.includes('429')) { log(`   ${texto} — freno y guardo lo conseguido.`); break }
      } else {
        for (const json of trocear(texto)) {
          for (const n of walk(json)) {
            if (Array.isArray(n)) continue
            const c = n.code ?? n.shortcode
            if (typeof c === 'string' && CODE.test(c) && esMedia(n)) {
              // El objeto real gana, pero se conserva el pk por si hay que repetir.
              media[c] = { ...n, __pk: media[c]?.__pk ?? null }
            }
          }
        }
        if (media[code]?.caption?.text?.trim()) ok++
      }
      if ((i + 1) % 25 === 0) { log(`   ${i + 1}/${faltan.length} · ${ok} con caption · ${fallos} fallos`); guardar() }
      await espera(700)   // ritmo humano: es tu cuenta
    }
    log(`Rehidratados: ${ok}/${faltan.length} con caption${fallos ? ` · ${fallos} fallos` : ''}.`)
    guardar()
  }
}

guardar()

const dentroVentana = Object.values(items).filter(i => i.ms && i.ms >= corte)
const conPost = Object.values(items).filter(i => i.codes.length)
const porTipo = Object.values(items).reduce((a, i) => { a[i.tipo] = (a[i.tipo] ?? 0) + 1; return a }, {})
const v = masViejo()

console.log(`
  Volcado del DM terminado.
    mensajes en la base ........... ${total()}   (${total() - arranque} nuevos)
    de ellos con post compartido .. ${conPost.length}
    dentro de los ${String(DIAS).padStart(2)} días .......... ${dentroVentana.length}
    posts distintos ............... ${Object.keys(media).length}
    el más antiguo alcanzado ...... ${v ? fecha(v) : '—'}

    por tipo de mensaje:
${Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, x]) => `      ${String(x).padStart(4)}  ${k}`).join('\n') || '      —'}

  Siguiente: npm run parse:dm && npm run identify:dm
`)
process.exit(0)

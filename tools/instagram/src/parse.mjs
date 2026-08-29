// PASO 2 — Normalizar.
// De los objetos crudos de Instagram (dos formas distintas según el endpoint) a una
// ficha plana por post. Aquí no se decide nada todavía: solo se aplana.
//
// Con `--dm` la entrada no son los guardados sino los mensajes de una conversación, y eso
// añade una capa: el mismo post puede haberse compartido varias veces, y lo que ordena la
// lista no es `taken_at` (cuándo se publicó, a veces hace años) sino `compartidoEl` (cuándo
// llegó al chat), que es el único campo sobre el que se puede cortar por fecha.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATA } from './session.mjs'

const DM = process.argv.includes('--dm')
// El hilo, para filtrar. El colector cosecha CUALQUIER mensaje que pase por una respuesta, y la
// bandeja de entrada manda vistas previas del último mensaje de las otras quince conversaciones.
// Sin este filtro se cuelan mensajes de gente que no tiene nada que ver.
const argv = i => (i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null)
const HILO = argv(process.argv.indexOf('--hilo'))

const MEDIA = join(DATA, DM ? 'dm-media.json' : 'media.json')
const ORIGEN = join(DATA, 'origen.json')
const POSTS = join(DATA, DM ? 'dm-posts.json' : 'posts.json')
const ITEMS = join(DATA, 'dm-items.json')
const HILOS = join(DATA, 'dm-hilos.json')

if (!existsSync(MEDIA)) {
  console.error(`  No hay ${MEDIA} todavía. Lanza antes: npm run ${DM ? 'collect:dm' : 'collect'}`)
  process.exit(1)
}

const TYPES = { 1: 'imagen', 2: 'video', 8: 'carrusel' }

function caption (m) {
  if (typeof m.caption?.text === 'string') return m.caption.text
  if (typeof m.caption === 'string') return m.caption
  const edge = m.edge_media_to_caption?.edges?.[0]?.node?.text
  return typeof edge === 'string' ? edge : ''
}

function location (m) {
  const l = m.location
  if (!l || typeof l !== 'object') return null
  return {
    name: l.name ?? null,
    address: l.address ?? null,
    city: l.city ?? null,
    lat: l.lat ?? null,
    lng: l.lng ?? null,
    id: l.pk ?? l.id ?? null,
  }
}

function bestVideo (m) {
  const versions = m.video_versions ?? []
  if (versions.length) return [...versions].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url
  return m.video_url ?? null
}

function bestThumb (m) {
  const candidates = m.image_versions2?.candidates ?? []
  if (candidates.length) return [...candidates].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url
  return m.display_url ?? m.thumbnail_url ?? m.thumbnail_src ?? null
}

const media = JSON.parse(readFileSync(MEDIA, 'utf8'))
// De qué colección de guardados venía cada post, si el volcado lo trajo.
const origen = existsSync(ORIGEN) && !DM ? JSON.parse(readFileSync(ORIGEN, 'utf8')) : {}

// ── El envoltorio del DM ──────────────────────────────────────────────────────
// Un índice code → el mensaje MÁS RECIENTE que lo trajo. Si Alba mandó el mismo reel dos
// veces vale la última: la ventana de 15 días pregunta por cuándo llegó, no por cuándo se
// mandó la primera copia.
const items = DM && existsSync(ITEMS) ? JSON.parse(readFileSync(ITEMS, 'utf8')) : {}
const hilos = DM && existsSync(HILOS) ? JSON.parse(readFileSync(HILOS, 'utf8')) : {}
// El remitente llega como `sender_fbid` en el esquema nuevo y como `user_id` (el pk) en el
// clásico. Se indexa por los dos para que el nombre salga venga como venga.
//
// OJO con quién falta: `usuarios` lista al OTRO del chat, no a ti. Tus propios mensajes traen un
// fbid que no está en ninguna lista, así que en vez de dejarlos en null se marcan como 'yo' por
// descarte — en un chat de dos, quien no es el otro eres tú.
const quien = {}
const ajenos = new Set()
for (const h of Object.values(hilos)) {
  for (const u of h.usuarios ?? []) {
    const ficha = { username: u.username ?? null, nombre: u.nombre ?? null }
    if (u.pk) { quien[u.pk] = ficha; ajenos.add(String(u.pk)) }
    if (u.fbid) { quien[u.fbid] = ficha; ajenos.add(String(u.fbid)) }
  }
}
const deQuien = id => {
  if (id == null) return { username: null, nombre: null }
  const f = quien[String(id)]
  if (f) return f
  return ajenos.size ? { username: 'yo', nombre: 'yo' } : { username: null, nombre: null }
}

// `--hilo` admite las dos formas con las que uno se topa: el id interno del hilo (`thread_fbid`,
// el que llevan los mensajes) y el número de la URL /direct/t/<n>, que en un chat de dos es el
// fbid DEL OTRO. Se acepta cualquiera y se resuelve al primero, porque escribir el de la URL es
// lo natural —es el que se ve— y fallaba en silencio dejando cero posts.
let hiloReal = HILO
if (HILO) {
  const ids = new Set(Object.values(items).map(i => i.threadId).filter(Boolean).map(String))
  if (!ids.has(String(HILO))) {
    const encontrado = Object.entries(hilos).find(([, h]) => (h.usuarios ?? []).some(u => String(u.fbid) === String(HILO) || String(u.pk) === String(HILO)))
    if (encontrado) hiloReal = encontrado[0]
  }
}

const sobre = {}
const huerfanos = new Map()   // codes que un mensaje nombró pero de los que no hay objeto media
for (const it of Object.values(items)) {
  if (hiloReal && it.threadId && String(it.threadId) !== String(hiloReal)) continue
  for (const code of it.codes ?? []) {
    const prev = sobre[code]
    if (!prev || (it.ms ?? 0) > (prev.ms ?? 0)) {
      sobre[code] = { ms: it.ms, compartidoEl: it.compartidoEl, tipoMensaje: it.tipo, itemId: it.itemId, remitente: deQuien(it.remitenteId).username, remitenteNombre: deQuien(it.remitenteId).nombre, crudo: it.crudo }
    }
    if (!media[code]) huerfanos.set(code, sobre[code])
  }
}

// Del envoltorio xma se rescata el título de la tarjeta: cuando no hay caption es lo único
// que nombra algo. No es fiable como nombre de local, pero sí como pista para la revisión.
function pistaXma (crudo) {
  if (!crudo) return null
  const textos = []
  const ver = n => {
    if (!n || typeof n !== 'object') return
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'string' && /title|subtitle|header|caption|preview_text/i.test(k) && v.trim().length > 2) textos.push(v.trim())
      else if (v && typeof v === 'object') ver(v)
    }
  }
  ver(crudo)
  return textos.length ? [...new Set(textos)].join(' · ').slice(0, 300) : null
}

const posts = []

for (const [code, m] of Object.entries(media)) {
  if (DM && !sobre[code]) continue   // en modo DM solo interesa lo que pasó por el chat
  const text = caption(m)
  const isReel = m.product_type === 'clips' || m.media_type === 2 || Boolean(m.video_versions?.length) || Boolean(m.video_url)
  const takenAt = m.taken_at ?? m.taken_at_timestamp ?? null

  posts.push({
    code,
    coleccion: origen[code] ?? null,
    url: `https://www.instagram.com/p/${code}/`,
    reelUrl: isReel ? `https://www.instagram.com/reel/${code}/` : null,
    tipo: TYPES[m.media_type] ?? (isReel ? 'video' : 'imagen'),
    esReel: isReel,
    autor: m.user?.username ?? m.owner?.username ?? null,
    autorNombre: m.user?.full_name ?? m.owner?.full_name ?? null,
    coautores: (m.coauthor_producers ?? []).map(u => u.username).filter(Boolean),
    caption: text,
    hashtags: [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map(h => h.slice(1)))],
    menciones: [...new Set((text.match(/@[A-Za-z0-9._]+/g) ?? []).map(h => h.slice(1).replace(/\.$/, '')))],
    etiquetados: [
      ...(m.usertags?.in ?? []).map(t => t.user?.username),
      ...(m.edge_media_to_tagged_user?.edges ?? []).map(e => e.node?.user?.username),
    ].filter(Boolean),
    ubicacion: location(m),
    fecha: takenAt ? new Date(takenAt * 1000).toISOString().slice(0, 10) : null,
    videoUrl: bestVideo(m),
    thumbUrl: bestThumb(m),
    duracion: m.video_duration ?? null,
    vistas: m.play_count ?? m.view_count ?? null,
    ...(DM
      ? {
          compartidoEl: sobre[code].compartidoEl,
          compartidoMs: sobre[code].ms,
          remitente: sobre[code].remitente,
          remitenteNombre: sobre[code].remitenteNombre,
          tipoMensaje: sobre[code].tipoMensaje,
          hidratado: true,
        }
      : {}),
  })
}

// Los huérfanos entran igual, vacíos pero contados: un post del que no se pudo sacar nada
// sigue siendo un post que Alba mandó, y esconderlo falsearía el recuento.
if (DM) {
  for (const [code, s] of huerfanos) {
    posts.push({
      code,
      coleccion: null,
      url: `https://www.instagram.com/p/${code}/`,
      reelUrl: `https://www.instagram.com/reel/${code}/`,
      tipo: 'desconocido',
      esReel: true,
      autor: null,
      autorNombre: null,
      coautores: [],
      caption: '',
      hashtags: [],
      menciones: [],
      etiquetados: [],
      ubicacion: null,
      fecha: null,
      videoUrl: null,
      thumbUrl: null,
      duracion: null,
      vistas: null,
      compartidoEl: s.compartidoEl,
      compartidoMs: s.ms,
      remitente: s.remitente,
      remitenteNombre: s.remitenteNombre ?? null,
      tipoMensaje: s.tipoMensaje,
      hidratado: false,
      pistaXma: pistaXma(s.crudo),
    })
  }
}

const clave = DM ? (p => p.compartidoEl ?? '') : (p => p.fecha ?? '')
posts.sort((a, b) => clave(b).localeCompare(clave(a)))
writeFileSync(POSTS, JSON.stringify(posts, null, 2))

const conCaption = posts.filter(p => p.caption.trim()).length
const conUbicacion = posts.filter(p => p.ubicacion?.name).length
const reels = posts.filter(p => p.esReel).length

console.log(`
  Normalizados ${posts.length} posts → ${POSTS}

    reels / vídeo ............ ${reels}
    imagen / carrusel ........ ${posts.length - reels}
    con texto en el caption .. ${conCaption}
    con ubicación etiquetada . ${conUbicacion}${DM ? `
    sin rehidratar (vacíos) .. ${posts.filter(p => p.hidratado === false).length}
    rango de compartido ...... ${posts.at(-1)?.compartidoEl ?? '—'} → ${posts[0]?.compartidoEl ?? '—'}` : ''}

  Siguiente: npm run identify${DM ? ':dm' : ''}
`)

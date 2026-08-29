/* ─────────────────────────────────────────────────────────────────────────────
   VOLCADO DESDE LA CONSOLA DEL NAVEGADOR — sin contraseña, sin instalar nada.

   Requisito único: estar viendo instagram.com en un navegador DONDE YA ESTÉS
   LOGUEADO (el Mac, o Safari del iPhone conectado por cable con el Web Inspector).

   Cómo:
     1. Abre https://www.instagram.com/ y comprueba que te ve como tú.
     2. Abre la consola.  Mac: Cmd+Opt+J (Chrome) / Cmd+Opt+C (Safari).
        iPhone: Safari del Mac → menú Desarrollo → tu iPhone → la pestaña.
     3. Pega TODO este fichero y pulsa Enter.
        (Chrome pide escribir «allow pasting» la primera vez.)
     4. Al acabar te descarga «ig-guardados.json». Ese fichero es el que hay
        que pasarle a  npm run import <ruta>.

   Qué hace: pregunta a la API interna de Instagram por tus colecciones y las
   recorre paginando, con la sesión que ya tiene el navegador. Es lo mismo que
   hace la propia web cuando bajas por la rejilla, pero sin parar y guardando
   la respuesta completa — que trae caption, hashtags, ubicación con coordenadas
   y las URL del vídeo, cosas que en el HTML no están.
   ───────────────────────────────────────────────────────────────────────────── */

(async () => {
  const APP_ID = '936619743392459'          // el id del cliente web de Instagram
  const PAUSA = 900                          // ritmo humano entre páginas
  const headers = { 'x-ig-app-id': APP_ID, 'x-requested-with': 'XMLHttpRequest' }
  const dormir = ms => new Promise(r => setTimeout(r, ms))

  async function get (url, intento = 0) {
    const res = await fetch(url, { headers, credentials: 'include' })
    if (res.status === 429 || res.status >= 500) {
      if (intento >= 4) throw new Error(`${res.status} en ${url}`)
      const espera = 5000 * (intento + 1)
      console.warn(`   Instagram frena (${res.status}). Espero ${espera / 1000}s...`)
      await dormir(espera)
      return get(url, intento + 1)
    }
    if (!res.ok) throw new Error(`${res.status} en ${url}`)
    return res.json()
  }

  // Encuentra los posts en cualquier JSON, sea cual sea la forma del endpoint.
  function * walk (n) {
    if (!n || typeof n !== 'object') return
    yield n
    for (const v of Object.values(n)) if (v && typeof v === 'object') yield * walk(v)
  }
  function harvest (json) {
    const out = []
    for (const n of walk(json)) {
      if (Array.isArray(n)) continue
      const code = n.code ?? n.shortcode
      if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{8,14}$/.test(code)) continue
      if ('media_type' in n || 'image_versions2' in n || 'display_url' in n ||
          'video_versions' in n || 'thumbnail_url' in n) out.push([code, n])
    }
    return out
  }

  const media = {}
  const origen = {}   // code -> nombre de la colección donde estaba

  async function paginar (url, etiqueta) {
    let maxId = ''
    let pagina = 0
    let antes = Object.keys(media).length
    while (pagina < 200) {
      const sep = url.includes('?') ? '&' : '?'
      const json = await get(`${url}${maxId ? `${sep}max_id=${encodeURIComponent(maxId)}` : ''}`)
      const encontrados = harvest(json)
      for (const [code, node] of encontrados) {
        media[code] = node
        origen[code] ??= etiqueta
      }
      pagina++
      console.log(`   ${etiqueta} · página ${pagina} · +${encontrados.length} · total ${Object.keys(media).length}`)
      const siguiente = json.next_max_id ?? json.next_page_token
      if (!json.more_available || !siguiente) break
      maxId = typeof siguiente === 'string' ? siguiente : String(siguiente)
      await dormir(PAUSA)
    }
    return Object.keys(media).length - antes
  }

  console.log('Buscando tus colecciones de guardados...')
  let colecciones = []
  try {
    const lista = await get('/api/v1/collections/list/?collection_types=%5B%22ALL_MEDIA_AUTO_COLLECTION%22%2C%22MEDIA%22%5D')
    colecciones = (lista.items ?? []).map(c => ({
      id: c.collection_id,
      nombre: c.collection_name ?? String(c.collection_id),
      n: c.collection_media_count ?? null,
    }))
    console.log(`Colecciones: ${colecciones.map(c => `${c.nombre}${c.n != null ? ` (${c.n})` : ''}`).join(' · ') || 'ninguna'}`)
  } catch (e) {
    console.warn('No he podido listar colecciones, voy solo a «todos los guardados»:', e.message)
  }

  // Todos los guardados. Es el conjunto grande y el que da el denominador real.
  try {
    await paginar('/api/v1/feed/saved/posts/', 'todos los guardados')
  } catch (e) {
    console.warn('El feed general ha fallado, tiro solo de colecciones:', e.message)
  }

  // Y cada colección, para saber de qué carpeta viene cada sitio.
  for (const c of colecciones) {
    if (c.id === 'ALL_MEDIA_AUTO_COLLECTION') continue
    try {
      await paginar(`/api/v1/feed/collection/${c.id}/posts/`, c.nombre)
    } catch (e) {
      console.warn(`   Colección «${c.nombre}» ha fallado:`, e.message)
    }
    await dormir(PAUSA)
  }

  const salida = {
    generado: new Date().toISOString(),
    colecciones,
    origen,
    media,
  }
  const total = Object.keys(media).length
  console.log(`\n✅ ${total} posts recogidos. Descargando ig-guardados.json...`)

  const blob = new Blob([JSON.stringify(salida)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ig-guardados.json'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 4000)

  window.__igDump = salida   // por si la descarga falla: queda aquí a mano
  console.log('Si la descarga no ha salido, el resultado está en window.__igDump')
})()

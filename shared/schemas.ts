// Esquema zod del modelo de la guía de Vietnam — FUENTE ÚNICA DE VERDAD.
//
// Vive en `shared/` (no inline en content.config.ts) porque lo comparten dos consumidores que
// deben usar el MISMO contrato: content.config.ts (genera tipos + columnas SQL de Nuxt Content)
// y los tests de tests/data (la verdadera puerta de validación — Content v3 NO valida los
// `type:'data'` contra zod en build, nuxt/content#3351).
//
// Reglas heredadas de la plataforma (ver memoria [[plataforma-guias-nuxt]]):
//  - `import { z } from 'zod'`, NUNCA el re-export de '@nuxt/content' (deprecado).
//  - El ancla estable es `slug` (= basename del fichero), NUNCA `id` (campo reservado que
//    Content sobrescribe). El campo del hero se llama `heroMeta`, nunca `meta` (también reservado).
//  - Nada de `.refine()` cross-fichero: se pierde al pasar a JSON-Schema. Cross-refs van en tests.
//
// A DIFERENCIA de Roma: aquí NO hay uniones discriminadas (evitamos el workaround del superset
// plano por el que Content v3 no materializa columnas). Cada colección es un `z.object` directo.
// El modelo sale de los dos archetipos de la Parte II validados en el mockup:
//   · ACTO  — narrativa que se lee del tirón (los cinco actos de la historia, el imperio jemer).
//   · FICHA — consulta que se mira antes de una visita (tam giáo, cómo leer un templo, minorías…).
import { z } from 'zod'

// Markdown-inline (o multi-párrafo): se renderiza con <MDC>. **negrita**, *cursiva*, `> citas`,
// listas… El corpus cultural es prosa, así que casi todo el texto es de este tipo.
export const Md = z.string()

// Enlace a otra ficha/lugar por su ancla (#slug) — el "dónde lo veréis".
export const Link = z.object({
  ref: z.string(), // '#angkor-wat' o URL externa
  label: z.string(),
})

// Sección de prosa con encabezado opcional (D-01 de Roma: array ORDENADO, encabezados libres —
// varían por ficha: "El templo-montaña es el Meru", "El vocabulario de piedra"…).
const Section = z.object({
  heading: z.string().optional(),
  body: Md, // markdown, puede tener varios párrafos, listas y citas
})

// Foto principal de una tarjeta (plato/bebida · ficha de lugar). Es SIEMPRE un WebP local en
// public/img/… descargado de Wikimedia Commons y optimizado (nunca una URL remota — los thumbnails
// de Wikimedia son un MD5 del nombre y adivinarlos da 404). `src` es RELATIVO a baseURL: el componente
// CardPhoto antepone useRuntimeConfig().app.baseURL para que resuelva bajo /guiaJapon/ en GH Pages.
// `credit` cumple la atribución que exige la licencia (autor · licencia); `creditUrl` → página de Commons.
export const Img = z.object({
  src: z.string(), // 'img/platos/pho.webp' — relativo, sin barra inicial
  alt: z.string(), // texto alternativo descriptivo (accesibilidad)
  credit: z.string(), // 'Codename5281 · CC BY-SA 3.0'
  creditUrl: z.string().optional(), // enlace a la página del fichero en Commons
})

// ── ACTO narrativo (cinabrio) ────────────────────────────────────────────────
// Se lee del tirón. numeral árabe grande + capitular en el lead + citas destacadas (blockquotes
// dentro del body) + caja "lo veréis sobre el terreno" al final.
export const ActoSchema = z.object({
  slug: z.string(), // 'acto-4-guerra-americana'
  trip: z.string(), // 'vietnam'
  part: z.enum(['japon']), // el viaje es de un solo país; el eje geográfico lo lleva `zone`
  order: z.number(), // orden dentro de la parte
  numeral: z.string(), // '4' (árabe; NO romano, NO vietnamita — decisión del mockup)
  kicker: z.string(), // 'Historia de Vietnam · acto cuarto de cinco'
  title: Md, // 'La guerra que aquí llaman *«americana»*' (la cursiva va en cinabrio)
  navLabel: z.string().optional(), // etiqueta corta para el índice flotante (si falta, se deriva del title)
  lead: Md, // primer párrafo — recibe la capitular
  body: Md, // resto de la prosa (multi-párrafo; las `> citas` se estilan como pull-quotes)
  connect: z.object({ label: z.string(), body: Md }).optional(), // caja "lo veréis sobre el terreno"
})

// ── FICHA de consulta (índigo, modelo B: cabecera índigo + cuerpo en papel) ──
// Se mira antes de la visita. emblema + epíteto + secciones con título + chips "dónde lo veréis".
export const FichaSchema = z.object({
  slug: z.string(), // 'como-leer-templo-jemer'
  trip: z.string(),
  part: z.enum(['japon']),
  order: z.number(),
  emblem: z.string().default('loto'), // clave del SVG del emblema (ver EMBLEMS en FichaCard)
  kicker: z.string(), // 'Camboya · cómo mirar'
  title: z.string(), // 'Cómo leer un templo jemer'
  navLabel: z.string().optional(), // etiqueta corta para el índice flotante (si falta, se usa el title)
  zone: z.string().optional(), // sub-grupo geográfico del índice ('Hanói', 'El loop de Hà Giang'…)
  image: Img.optional(), // foto principal (banner) — solo fichas de monumento/emplazamiento
  epithet: Md.optional(), // la frase-tesis en cursiva bajo el título
  sections: z.array(Section),
  curiosidades: z.array(Md).optional(), // "Curiosidades": los detalles memorables (anécdotas, cifras
  // deliciosas, el dato que se queda grabado). Cada uno un markdown, con el gancho en **negrita**.
  seenIn: z.array(Link).optional(), // "dónde lo veréis" → chips
})

// ── INVERSIÓN — la ficha de decisión de dinero (Parte I) ─────────────────────
// El archetipo de "gastar donde merece la pena": veredicto claro + el desglose cuesta/qué
// compra/la alternativa. La regla que la hace creíble: algunas SALEN "prescindible".
export const InversionSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  order: z.number(),
  kicker: z.string(), // "Reservar en julio" / "Decisión de dinero"
  title: Md, // "Los vuelos internos"
  navLabel: z.string().optional(), // etiqueta corta para el índice flotante (si falta, se deriva del title)
  verdict: z.enum(['imprescindible', 'merece', 'solo-si', 'prescindible']), // color del badge
  verdictLabel: z.string(), // texto del badge ("Merece la pena", "Prescindible — y peor"…)
  lede: Md, // la decisión en una frase
  ledger: z.array(z.object({ label: z.string(), body: Md })), // Cuesta / Qué compra / La alternativa
  curiosidades: z.array(Md).optional(),
})

// ── DÍA del itinerario (Parte I) — "la espina del día" ───────────────────────
// El eje del plan NO es la agenda por horas sino los BLOQUES del día (amanecer/mañana/mediodía/
// tarde/noche) con su "ventana óptima": por qué ENTONCES (luz, gentío, calor), no a qué hora.
// Se renderiza como una espina vertical (timeline): cada bloque es un nodo del arco del día.
export const DiaSchema = z.object({
  slug: z.string(), // 'dia-5-kamakura'
  trip: z.string(),
  order: z.number(), // 1..8, orden cronológico del viaje
  // ── TRAMO — de quién es este día (ago 2026) ────────────────────────────────
  // El viaje del grupo son los días 1-21 y es lo que lee todo el mundo. Pero uno de los cuatro
  // llega el 2 de noviembre, cuatro días antes que los demás, y esos días son SUYOS: no se pueden
  // mezclar en la espina común porque los otros tres leerían un plan que no es el suyo. `solo` los
  // saca a su propia sección, detrás del plan del grupo. Si falta, el día es del grupo.
  tramo: z.enum(['grupo', 'solo']).optional(),
  navLabel: z.string().optional(), // etiqueta corta para el índice flotante
  eyebrow: z.string(), // 'El plan · Día 5 · mar 10 nov'
  title: Md, // 'Kamakura, el *otro* Japón' (la *cursiva* va en momiji)
  dek: Md.optional(), // la frase de entrada del día
  blocks: z.array(z.object({
    block: z.string(), // 'Amanecer' / 'Mediodía · descanso'
    time: z.string().optional(), // '06:30' / '14:30–19:00' (referencia, no agenda estricta)
    title: z.string(), // 'El Gran Buda de Kōtoku-in'
    body: Md, // la prosa del bloque
    // "ventana óptima": el porqué de ese momento (luz/gentío/frío). El alma del plan.
    window: z.object({ label: z.string(), body: Md }).optional(),
    dim: z.boolean().optional(), // bloque de descanso → nodo en oro, no en momiji
    // RUTA A PIE (sep 2026): un mapa horneado con el recorrido en puntitos y un enlace a Google Maps
    // para reproducirlo. Para los paseos cortos donde «ir a X» es ambiguo —Chūō-dōri mide kilómetros
    // y Maps la resuelve en Ginza—. Las coordenadas tienen que salir de una fuente (el hotel, OSM):
    // nunca inventadas (regla 4.5). La imagen y el trazado los genera scripts/build-routemap.mjs.
    ruta: z.object({
      slug: z.string(), // nombre de la imagen: public/img/rutas/<slug>.webp
      desde: z.object({ nombre: z.string(), lat: z.number(), lon: z.number() }),
      hasta: z.object({ nombre: z.string(), lat: z.number(), lon: z.number() }),
    }).optional(),
    // QUÉ VER Y DÓNDE COMER (sep 2026). El día era el único sitio que se lee de corrido, y las
    // fichas, la gastronomía y los recomendados de Alba quedaban en secciones aparte que había que
    // descubrir: de 115 locales solo 16 salían en algún día. Estas dos listas los cruzan con el
    // bloque en el que caen, POR REFERENCIA: el día no copia la ficha ni el local, los pinta en
    // pequeño (foto, una línea, enlaces) y salta a la tarjeta entera. Una sola fuente de verdad.
    //
    //  · `ver` — una ficha (`ficha`), un recomendado (`reco`) o un sitio suelto sin ficha (`nombre`
    //    + `maps`, la consulta de búsqueda de Google Maps: regla 4.5). `nota` es UNA línea, con
    //    `inlineMd`: sin enlaces (trampa 3.2). Coordenadas solo para el sitio suelto, y de fuente.
    //  · `comer` — slugs de `comidas/`, con una `nota` opcional de por qué en este bloque.
    ver: z.array(z.object({
      ficha: z.string().optional(),
      reco: z.string().optional(),
      nombre: z.string().optional(),
      maps: z.string().optional(),
      nota: z.string().optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
    })).optional(),
    comer: z.array(z.object({
      comida: z.string(),
      nota: z.string().optional(),
    })).optional(),
  })),
  // ── TRASLADOS — el nodo de conexión (ago 2026) ─────────────────────────────
  // Los bloques cuentan QUÉ SE HACE; esto cuenta CÓMO SE LLEGA, que en un viaje de once mudanzas es
  // la mitad de la logística y estaba disuelta en la prosa. Va aparte y en la CABECERA del día,
  // porque un traslado no es un momento sino la costura entre dos días: se lee de un vistazo la
  // víspera —medio · duración · a qué hora salir— y no leyéndose el bloque entero.
  //
  // `hora` es RECOMENDACIÓN, no horario oficial: los horarios de 2026 no están publicados y los de
  // los autobuses de montaña cambian en noviembre. Escribe «salir 09:00», no «09:04».
  //
  // `medio` y `nota` se sirven con `inlineMd`, así que NO admiten enlaces (trampa 3.2). El porqué
  // de cada trayecto —y sus enlaces— va en el `body` del bloque que lo cuenta.
  traslados: z.array(z.object({
    desde: z.string(),
    hasta: z.string(),
    medio: Md, // 'Limited express *Azusa*' · 'Autobús Nōhi'
    duracion: z.string(), // '2 h 40' · '25 min'
    hora: z.string().optional(), // 'salir 09:00' · 'último a las 17:30'
    nota: Md.optional(), // 'No lleva vagón libre: asiento reservado obligatorio'
  })).optional(),

  // ── DUERME — dónde acaba el día (sep 2026) ─────────────────────────────────
  // Slugs de `hoteles/` en los que se duerme ESA noche. Pinta en la cabecera del día un enlace a la
  // tarjeta de «Dónde dormir», para no tener que buscar el hotel en el directorio. Es una lista
  // porque un tramo puede tener dos `candidato` compitiendo: se listan los dos hasta que uno se
  // confirme. Sin campo = no se duerme en tierra (la noche del vuelo). Lo valida schema.spec.ts.
  duerme: z.array(z.string()).optional(),

  // ── MAPA DEL DÍA — el recorrido de un vistazo (sep 2026) ────────────────────
  // Un mapa horneado al final del día con las paradas numeradas en orden, las zonas en círculos
  // (se calculan de sus paradas: nada de coordenadas a ojo) y cómo se llega a cada una: a pie en
  // puntitos por las calles reales, en metro o tren en línea discontinua. Es para RECORDAR el día
  // sin releerlo, no para navegar: para eso está el enlace de Maps de cada sitio en el cuerpo.
  // Coordenadas siempre de fuente (el hotel, OSM). Lo genera scripts/build-routemap.mjs.
  mapa: z.object({
    slug: z.string(), // public/img/rutas/<slug>.webp
    paradas: z.array(z.object({
      nombre: z.string(),
      hora: z.string().optional(), // '06:00' — la del bloque, orientativa
      zona: z.string().optional(), // 'Asakusa' — agrupa paradas en un círculo con nombre
      llegada: z.enum(['a-pie', 'metro', 'tren', 'bus']).optional(), // cómo se llega desde la anterior
      lat: z.number(),
      lon: z.number(),
    })).min(2),
  }).optional(),

  // ── ALTERNATIVAS — nuevo en Japón ──────────────────────────────────────────
  // Este viaje tiene DOS lectores a la vez: tres primerizos, para los que el plan principal son los
  // clásicos bien contados, y un repetidor (quinto viaje) que ya los ha visto. En vez de escribir dos
  // guías, cada día puede llevar sus desvíos: qué hacer en su lugar, o después, si te desmarcas del
  // grupo. Se renderiza aparte del arco del día — es una carta, no una instrucción.
  alt: z.object({
    label: z.string().optional(), // 'Si te desmarcas' (default en el componente)
    body: Md, // la prosa de las alternativas
  }).optional(),
})

// ── RECOMENDACIÓN — el directorio práctico (Parte I): dónde dormir + qué reservar ──
// El área para "mirar hoteles, reservas": tarjetas agrupadas por `kind` (dormir/reservar/comer/
// moverse), cada una con su estado de reserva (chip) y su meta (precio/noches/cuándo). Es la capa
// práctica del plan — no la decisión de dinero (eso es InversionCard), sino el qué/dónde/cuándo.
export const RecoSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  order: z.number(), // orden dentro de su grupo
  // Categoría (define el grupo). 'comer' migró a Gastronomía. 'practico' = los prácticos EN DESTINO
  // (dinero, salud, seguridad, conectividad, equipaje): tarjetas de consulta, sin estado de reserva —
  // por eso `status` es opcional y estas no lo llevan.
  kind: z.enum(['dormir', 'reservar', 'moverse', 'practico']),
  navLabel: z.string().optional(),
  title: z.string(), // 'El Hòa Bình' / 'El loop de Hà Giang'
  area: z.string().optional(), // 'Hanoi · barrio francés' / 'Ninh Bình'
  status: z.enum(['reservado', 'pendiente', 'opcional']).optional(), // chip de estado
  // OJO: NO llamar a este campo `meta` — es nombre RESERVADO de Content v3 (lo sobrescribe con un
  // objeto → «[object Object]»). Igual que el hero usa `heroMeta`, aquí es `note`.
  note: z.string().optional(), // '3 noches · ~40 €/noche' / 'agosto · 30 USD/persona'
  body: Md, // el porqué + el cómo
  link: z.object({ url: z.string(), label: z.string() }).optional(), // reserva / Google Maps
})

// ── COMIDA — la entrada del directorio gastronómico (sección «Gastronomía») ───
// Un restaurante / café / puesto / bar. Se agrupa por `part` (país) → `city` → `category` (el orden
// del cliente). Los chips de un vistazo (tipo · precio · reserva · colas · VEG · sello) son campos
// estructurados; el porqué va en `body`. `veg` es OBLIGATORIO y siempre explícito (la novia es
// vegetariana en las guías que la necesiten). `badge` = sello de prestigio verificado (★ Michelin, Bib Gourmand, Asia's 50 Best,
// Vietnam Coracle…). NO usar `meta` (reservado de Content v3 → «[object Object]»).
export const ComidaSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  part: z.enum(['japon']),
  city: z.string(), // 'Hanoi' · 'Ninh Bình' · 'Hà Giang' · 'Siem Reap'
  category: z.enum(['desayuno', 'cafe', 'comida', 'cena', 'street-food', 'postre', 'cocteleria']),
  order: z.number(), // orden dentro de (part·city·category)
  title: z.string(), // nombre del local
  navLabel: z.string().optional(),
  tipo: z.string(), // 'puesto callejero' · 'familiar' · 'moderno' · 'histórico' · 'rooftop'…
  area: z.string().optional(), // zona / dirección aproximada
  cuando: z.string().optional(), // encaje logístico con el itinerario: 'Casco viejo · cualquier día' · 'West Lake · Día 15'
  soloEl: z.boolean().optional(), // sin uso en este viaje (heredado de guiaVietnam, donde separa los no aptos)
  precio: z.string().optional(), // '50–70k ₫ (~2–2,6 €)'
  reserva: z.string().optional(), // 'No' · 'Recomendable' · 'Imprescindible'
  colas: z.string().optional(), // 'Sí, van rápidas' · 'No'
  // Sin vegetarianos en este viaje (los cuatro comen de todo), así que el campo no se pide ni se
  // pinta. Se conserva opcional por si una guía futura lo necesita — en guiaVietnam sí es central.
  veg: z.string().optional(),
  badge: z.string().optional(), // sello: '★ Michelin' · 'Bib Gourmand' · "Asia's 50 Best" · 'Vietnam Coracle'…
  // QUIÉN LO RECOMIENDA (ago 2026). No confundir con `badge`, que es PROCEDENCIA VERIFICADA de un
  // sello de prestigio: esto es autoría de la recomendación, la persona del grupo que trajo el
  // sitio. La mayoría de las 61 fichas no lo llevan —salen de guías y de fuentes publicadas— y se
  // quedan sin chip; solo se marca lo que viene de alguien concreto, que es lo que permite luego
  // decir en un día «y cerca tenéis estos de Alba». Enum y no texto libre: son dos personas y una
  // errata escrita a mano se vería igual de bien y agruparía mal.
  fuente: z.enum(['alba', 'pablo']).optional(),
  // El post del que salió la recomendación. Va aparte de `link` —que es la reserva o la web del
  // local— porque son dos cosas distintas: uno lleva a reservar mesa, el otro a ver el vídeo que
  // convenció a alguien. La sección «Recomendados» lo usa para poder volver al original.
  fuenteUrl: z.string().optional(),
  quePedir: Md.optional(), // qué pedir
  // Posición para el mapa del día. De fuente (OSM), nunca a ojo: si no se encuentra, se deja sin
  // ellas y el local sale en la lista del día pero no en el mapa.
  lat: z.number().optional(),
  lon: z.number().optional(),
  body: Md, // por qué merece la pena (+ contexto/fuente)
  link: z.object({ url: z.string(), label: z.string() }).optional(),
  seenIn: z.array(Link).optional(), // cruces (plato relacionado, ficha de lugar…)
})

// ── RECOMENDADO — lo que trae alguien del grupo y no es un restaurante ────────
// Nace de un caso concreto (ago 2026): Alba compartió doscientos reels de Japón por mensaje
// privado y la mitad no eran sitios de comer — un mercado de antigüedades con fecha fija, un
// taller donde graban palillos, el truco de la bolsa de rafia que pasa como facturada.
//
// POR QUÉ NO CABÍA EN LO QUE YA HABÍA. Un local de comer es una `comida` (y ahí `fuente` dice
// quién lo trajo). Pero un mercado no es gastronomía, un taller no es alojamiento y un aviso de
// estafa no es una `reco` —cuyos `kind` son dormir/reservar/moverse/practico y describen la
// logística del viaje, no un hallazgo de alguien—. Meterlos a la fuerza en cualquiera de las tres
// habría roto el criterio de esas secciones, que es lo que las hace legibles.
//
// La regla 4.1 sigue mandando: el DÍA dice qué se hace, esto dice QUÉ ES y de dónde salió. Por eso
// `dia` es un enlace al día donde encaja y no una copia de su plan.
//
// `url` es OBLIGATORIO y es la razón de ser de la colección: se puede volver al post original.
export const RecomendadoSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  order: z.number(), // orden dentro de (fuente · kind)
  fuente: z.enum(['alba', 'pablo']), // quién lo trajo. Aquí NO es opcional: sin autor no hay sección.
  kind: z.enum(['ver', 'taller', 'truco']), // sitio al que ir · experiencia que se hace · aviso práctico
  title: z.string(),
  navLabel: z.string().optional(),
  tipo: z.string(), // 'mercado de antigüedades' · 'taller de palillos' · 'truco de equipaje'
  city: z.string().optional(),
  area: z.string().optional(),
  cuando: z.string().optional(), // encaje con el itinerario: 'Día 2 · sáb 7 nov · 9:00-16:00'
  // El día donde encaja. Enlace, no texto: así el índice de anclas lo valida y no se queda colgado
  // si algún día se renumeran las jornadas (que ya ha pasado dos veces).
  dia: Link.optional(),
  aviso: z.string().optional(), // la condición que lo puede tumbar: 'Cierra si llueve'
  body: Md, // qué es y por qué merece la pena, en dos o tres frases
  url: z.string(), // el post original — sin esto la sección no tiene sentido
  lat: z.number().optional(), // para el mapa del día; de fuente, como en `comidas`
  lon: z.number().optional(),
  link: z.object({ url: z.string(), label: z.string() }).optional(), // web oficial / Google Maps
  seenIn: z.array(Link).optional(),
})

// ── PLATO — la guía de platos y bebidas imprescindibles ───────────────────────
// Ficha de un PLATO o BEBIDA (no un local): qué es, historia, dónde probarlo, versión veg, picante.
// `veg` obligatorio y explícito. `seenIn` enlaza a los locales (comida) donde probarlo.
export const PlatoSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  kind: z.enum(['plato', 'bebida']),
  order: z.number(),
  title: z.string(), // nombre del plato/bebida
  navLabel: z.string().optional(),
  image: Img.optional(), // foto principal (banner) del plato/bebida
  queEs: Md, // en qué consiste
  historia: Md.optional(), // historia / curiosidad
  dondeMejor: z.string().optional(), // dónde se prepara mejor
  picante: z.string().optional(), // 'Suave' · 'Medio' · 'Alto' · '—'
  veg: z.string().optional(), // sin vegetarianos en este viaje; ver nota en ComidaSchema
  body: Md.optional(),
  seenIn: z.array(Link).optional(), // dónde probarlo → enlaces a locales (comida)
})

// ── SALIR — música en vivo (jazz) y librerías (sección «Salir · música y librerías») ──────────
// No es gastronomía: sitios para la tarde-noche (un club de jazz, una librería). Se agrupa por `kind`.
export const SalirSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  kind: z.enum(['jazz', 'libreria']),
  city: z.string(),
  order: z.number(),
  title: z.string(),
  navLabel: z.string().optional(),
  tipo: z.string(),
  area: z.string().optional(),
  cuando: z.string().optional(),
  precio: z.string().optional(),
  reserva: z.string().optional(),
  body: Md,
  link: z.object({ url: z.string(), label: z.string() }).optional(),
  seenIn: z.array(Link).optional(),
})

// ── HOTEL — la entrada del directorio de alojamiento (sección «Dónde dormir») ─
// Un alojamiento de un tramo del itinerario. Se agrupa por `city`, que NO es la ciudad a secas sino
// la PARADA («Tokio · Akihabara» y «Tokio · Roppongi» son dos, porque en Tokio se duerme en tres
// barrios distintos y esa es la trampa que más ficheros toca de esta guía).
//
// `status` es lo que hace útil la sección durante los meses previos: un tramo puede tener DOS
// entradas en `candidato` compitiendo (reserva doble con cancelación gratuita) y se resuelve
// pasando una a `confirmado` y borrando la otra. `deadline` es la fecha en que eso deja de ser
// gratis — el dato que de verdad caduca.
//
// NO usar `meta` ni `id`: reservados de Content v3 (los sobrescribe). Por eso la línea suelta de
// datos se llama `nota`, igual que en RecoSchema.
export const HotelSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  city: z.string(), // la PARADA: 'Tokio · Akihabara' · 'Kamikōchi' · 'Kioto'
  order: z.number(), // orden dentro de la colección (itinerario); único en todo el viaje
  status: z.enum(['confirmado', 'candidato', 'descartado']),
  title: z.string(), // nombre del hotel
  navLabel: z.string().optional(),
  tipo: z.string(), // 'hotel de negocios' · 'ryokan' · 'casa de montaña' · 'business nuevo'
  area: z.string().optional(), // 'Kanda-Sudachō, Chiyoda'
  noches: z.string().optional(), // '5 noches · días 1-5'
  // Las estaciones a pie, ESTRUCTURADAS (no una frase suelta): de aquí salen a la vez la línea
  // resumen de la tarjeta y el diagrama de StopMap, que se autocompone sin coordenadas a mano.
  // Una parada nueva no necesita geometría: basta con listar sus estaciones.
  estaciones: z.array(z.object({
    nombre: z.string(), // 'Akihabara'
    lineas: z.string().optional(), // 'JR Yamanote · Chūō-Sōbu · Hibiya · Tsukuba Express'
    minutos: z.number(), // andando, desde la puerta del hotel
    lat: z.number().optional(),
    lon: z.number().optional(),
  })).optional(),
  // Coordenadas VERIFICADAS (Nominatim/Overpass, contrastadas contra la dirección postal) — de
  // ellas sale el mapa real que hornea scripts/build-stopmap.mjs. La regla 4.5 sigue en pie: no se
  // inventan. Si un alojamiento no geocodifica con certeza, se deja sin lat/lon y no sale en el mapa.
  lat: z.number().optional(),
  lon: z.number().optional(),
  // Foto del establecimiento. OJO: no es una foto de Commons como el resto de la guía — las de un
  // hotel concreto no existen con licencia libre. Va con `credit` al establecimiento y `creditUrl`
  // a su ficha de reserva. Si algún día hay foto propia (fotos-originales/), sustituye a esta.
  image: Img.optional(),
  precio: z.string().optional(), // total del tramo, no por noche
  habitaciones: z.string().optional(), // 'Dos dobles' — los cuatro no caben en una
  rating: z.string().optional(), // '8,6 · 1.428 reseñas' — SIEMPRE con la fuente y verificado
  deadline: z.string().optional(), // 'Cancelación gratuita hasta el 5 de noviembre'
  nota: z.string().optional(), // línea suelta. NUNCA `meta` (reservado de Content v3)
  body: Md, // el porqué: qué compra esa ubicación y qué se paga por ella
  link: z.object({ url: z.string(), label: z.string() }).optional(), // la reserva
  seenIn: z.array(Link).optional(), // cruces (ficha de barrio, día…)
})

// ── PARADA — los puntos de interés que salen en el mapa de «Dónde dormir» ─────
// OJO, ESTA NO ES UNA COLECCIÓN DE NUXT CONTENT, y es a propósito. Sus datos sólo los consume
// scripts/build-stopmap.mjs, que hornea el mapa en build y deja las posiciones ya calculadas en
// app/components/stopMapsGeo.js. Registrarla en content.config.ts obligaría a Content a materializar
// un `sql_dump.txt` que nadie consulta — y en una PWA con precaché total eso es peso muerto que se
// descarga en cada móvil. Aquí no hace falta: el runtime nunca la mira.
//
// Lo que sí hace falta es VALIDARLA, porque un `lat` escrito como texto rompería el mapa en
// silencio. De eso se encarga tests/data/schema.spec.ts, que lee los .yml del disco y no depende de
// Content para nada. Por eso el fichero vive en content/ pero fuera del registro de colecciones.
//
// `puntos` sale del contenido que ya existe: son los lugares que nombra la ficha del barrio, con las
// coordenadas VERIFICADAS en Nominatim/Overpass contra su dirección. Regla 4.5: no se inventan. Si
// un sitio no geocodifica con certeza (Super Potato, que no está en OSM), se queda fuera del mapa.
export const ParadaSchema = z.object({
  slug: z.string(),
  trip: z.string(),
  city: z.string(), // debe COINCIDIR con el `city` de los hoteles de esa parada — es la clave de unión
  order: z.number(),
  puntos: z.array(z.object({
    nombre: z.string(),
    tipo: z.string(), // 'santuario' · 'catedral ortodoxa' · 'centro de arte'…
    lat: z.number(),
    lon: z.number(),
  })),
})

// ── TRIP — metadatos de portada ──────────────────────────────────────────────
export const TripSchema = z.object({
  slug: z.string(), // 'japon'
  title: Md, // con *cursiva* para el acento en momiji
  eyebrow: z.string(), // 'Tokio · Kamakura · … — 6 a 13 de noviembre de 2026'
  heroMeta: z.string().optional(),
  // Portada ilustrada, opcional. NO usa `Img`: esa exige `credit` porque son fotos de Commons con
  // licencia que atribuir, y esta es ilustración propia. Dos ficheros porque un recorte apaisado
  // no sobrevive a un móvil en vertical: `srcAlta` es la versión en retrato y la elige el <picture>.
  heroImage: z.object({
    src: z.string(), // 'img/hero/portada-ancha.webp' — relativo, sin barra inicial
    srcAlta: z.string().optional(), // versión en retrato para móvil
    alt: z.string(),
  }).optional(),
  quote: z.string().optional(),
  quoteAttr: z.string().optional(),
  lede: Md.optional(), // párrafo de entrada de la Parte II
  rationale: Md.optional(), // el porqué del itinerario — se renderiza bajo el mapa del viaje
  // Umbral de la Parte II (el relato cultural: actos + fichas). Este viaje es de un solo país,
  // así que lleva uno. Si algún día hay varios, esto pasa a ser un array indexado por `part`.
  relato: z.object({
    navLabel: z.string(), // etiqueta del grupo en el índice flotante
    anchor: z.string(), // id del umbral
    overline: z.string(),
    title: Md,
    dek: Md,
  }).optional(),
  // Umbral de la historia, que cierra la guía (los actos van los últimos).
  historia: z.object({
    navLabel: z.string(),
    anchor: z.string(),
    overline: z.string(),
    title: Md,
    dek: Md,
  }).optional(),
})

// ── Tipos TS derivados (una sola fuente de verdad) ────────────────────────────
export type Acto = z.infer<typeof ActoSchema>
export type Ficha = z.infer<typeof FichaSchema>
export type Inversion = z.infer<typeof InversionSchema>
export type Dia = z.infer<typeof DiaSchema>
export type Reco = z.infer<typeof RecoSchema>
export type Comida = z.infer<typeof ComidaSchema>
export type Recomendado = z.infer<typeof RecomendadoSchema>
export type Plato = z.infer<typeof PlatoSchema>
export type Salir = z.infer<typeof SalirSchema>
export type Hotel = z.infer<typeof HotelSchema>
export type Parada = z.infer<typeof ParadaSchema>
export type Trip = z.infer<typeof TripSchema>

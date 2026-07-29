# Cómo trabajar en esta guía

Manual de operaciones para quien continúe este repo —persona o agente—. No repite lo que se ve
leyendo el código: recoge **las decisiones, las convenciones y las trampas** que costaron tiempo
descubrir.

---

## 1. Qué es esto

Guía de viaje a Japón (**6–26 de noviembre de 2026**, 21 días, cuatro viajeros) publicada como sitio
estático en https://psl11.github.io/guiaJapon/. Bifurcada de `guiaVietnam`, que comparte plataforma.

**El dato que ordena todo el contenido:** el grupo son cuatro, **tres hacen los 21 días** y **uno
vuelve a Barcelona el 13 de noviembre** (la jornada 8). Para tres es su primer viaje a Japón; para el
cuarto, el quinto. La guía cuenta el viaje entero y sirve a los dos lectores a la vez.

**Y un dato que toca muchos ficheros: en Tokio se duerme en dos barrios distintos.** Las cinco
primeras noches en **Akihabara** y las cinco últimas en **Shinjuku**. No es casual —la ventaja de
Shinjuku es la noche, y la noche no se usa con jet lag— pero significa que **«donde dormís» no es
un sitio fijo**: antes de escribir esa expresión, mira de qué bloque hablas.

---

## 2. Arquitectura, en cuatro líneas

- **Nuxt 4** con `nuxi generate` → GitHub Pages (`nitro.preset: 'github_pages'`, `app.baseURL`).
- **@nuxt/content v3**, colecciones `type: 'data'` sobre ficheros YAML en `content/trips/japon/`.
- **Los esquemas viven en `shared/schemas.ts`** y los consumen dos sitios: `content.config.ts` (tipos
  y columnas SQL) y los tests. Una sola fuente de verdad.
- **PWA con precaché total** (`@vite-pwa/nuxt`): app shell, contenido y las 56 fotos, ~13 MB.

«Añadir un viaje = añadir ficheros»: los globs son `trips/*/…`, así que un viaje nuevo no toca código.

---

## 3. Las nueve trampas que ya nos han costado tiempo

**3.1 · Content v3 NO valida `type:'data'` contra zod en el build.** Es un fallo conocido
(nuxt/content#3351). Un YAML mal formado pasa el build y revienta en runtime. **La puerta real es
`tests/data/schema.spec.ts`**, que hace `safeParse` fichero a fichero. Ejecuta siempre
`npx vitest run tests` antes de dar nada por bueno.

**3.2 · Hay campos que NO renderizan Markdown.** `epithet`, `lead`, `lede`, todos los `title` y los
`sections[].heading` se sirven con `inlineMd`, que solo entiende `**fuerte**`, `*cursiva*` y
`` `código` ``. **Un enlace ahí sale como texto crudo.** Los enlaces solo van en los `body`. Lo
vigila `tests/data/inline-md-subset.spec.ts`.

**3.3 · `id` y `meta` son nombres reservados de Content v3.** Los sobrescribe. Por eso el ancla es
`slug`, el hero usa `heroMeta` y las recomendaciones usan `note`.

**3.4 · Los tests validan datos, no vista.** Es la lección más cara del repo: al bifurcar de
guiaVietnam, `TripView.vue` seguía filtrando por `part === 'vietnam'`, así que **los seis actos y las
29 fichas no se renderizaban en la web publicada** — y los 13 tests pasaban. Se descubrió abriendo la
página. **Después de cualquier cambio estructural, abre el sitio y cuenta lo que sale.**

**3.5 · El service worker sirve caché vieja.** Al verificar en producción parece que el despliegue no
ha entrado. Antes de diagnosticar nada, desregistra el SW y borra cachés:
`navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.keys()` → `delete()`.

**3.6 · YAML: un valor con dos puntos necesita comillas.** `title: Lo primero: soltar el equipaje`
rompe el parser. Los tests lo cazan, pero el error que dan (`Nested mappings…`) no señala la causa.

**3.7 · `zone` debe ser contigua y `order` único** por (colección · part). Si insertas una ficha en
medio, **renumera todo el bloque**, no solo el vecino.

**3.8 · `<MDC>` emite bloque; en contexto inline rompe la hidratación.** Un `<MDC unwrap="p">`
dentro de un `<h2>` o un `<p>` mete un `<div>` donde no cabe: HTML inválido, el navegador lo
reparienta y el árbol del cliente deja de coincidir con el del servidor. Se manifestó en guiaVietnam
como **pull-quotes que perdían su clase CSS al hidratar** — no como un error, que es lo que lo hace
difícil de cazar. La regla: **`<MDC>` solo dentro de su propio `<div>`; todo lo inline por
`inlineMd()`** (`app/utils/inline-md.ts`, auto-importado), que da el mismo HTML en los dos lados.
Al añadir un componente de tarjeta nuevo, esto es lo primero que hay que mirar.

**3.9 · El offline se rompió tres veces seguidas, y en silencio.** Es la peor de todas porque
**el sitio online funciona perfectamente**: nada avisa. Se descubrió porque las dos guías dieron un
500 de Nuxt en un avión. Las tres causas, en orden de gravedad:

1. **Nuxt genera `200.html` y `404.html`** (el *fallback* de GitHub Pages) y workbox los mete en el
   manifiesto **sin extensión** — `/guiaJapon/200`, `/guiaJapon/404`—, URL que no existen en el
   servidor. Como `precacheAndRoute` usa `addAll()`, **una sola petición fallida aborta la
   instalación entera**: el service worker no se activa nunca y no se cachea nada. Se veían 8 de 162
   entradas. Fix: `globIgnores: ['**/200.html', '**/404.html']`.
2. **Nuxt pide el payload con query de build** (`_payload.json?<uuid>`) y workbox lo tiene guardado
   sin query, así que el *lookup* falla, cae a la red y offline devuelve
   «Cannot read properties of undefined» → **página 500**. Fix:
   `ignoreURLParametersMatching: [/.*/]`.
3. **`@nuxt/content` v3 lee el contenido con SQLite compilado a WASM** (dos ficheros de 836 KB) y
   `wasm` no estaba en `globPatterns`. Los `sql_dump.txt` sí se cacheaban; el motor que los lee, no.

**Ya no hace falta descubrirlo en un avión: hay puerta.** `node scripts/check-offline.mjs` corre
después de `nuxi generate` —y **en CI antes de desplegar**— y falla con código 1 si vuelve a pasar
cualquiera de las tres. Está probada contra los tres bugs reales: se reintrodujo cada uno y los cazó.

**Y la comprobación manual, para cuando se toque el service worker:** `npx nuxi generate`, servir
`.output/public` bajo el subpath correcto, cargar, esperar a que el SW esté `active`, **matar el
servidor** y recargar. Si sale el 500, no hay offline. Es la única prueba que vale, porque
**con cobertura un sitio sin offline se ve exactamente igual que uno con offline**.

---

## 4. Convenciones editoriales

Estas no son gusto: son las reglas que mantienen la guía coherente y sin repeticiones.

**4.1 · El día dice QUÉ SE HACE; la ficha dice QUÉ ES.** Es la regla que más trabajo ha dado. Al
escribir los días 9-21 desde el mismo material que las fichas se duplicaron párrafos enteros —141
fragmentos idénticos entre el día 15 y la ficha de Hiroshima— y hubo que reescribir diecisiete
bloques. Si te descubres explicando historia dentro de un día, **enlaza a la ficha y borra**.

**4.2 · «El día N» es siempre la jornada del viaje.** Las fechas del calendario llevan siempre el mes
o el día de la semana: «el viernes 13», «el 14 de noviembre». Mezclarlo produjo un error real —«el
día 13» significaba el 13 de noviembre en cinco sitios, pero el día 13 del viaje es el 18.

**4.3 · Voz en segunda del plural** («vais», «conviene que»), salvo en el día 8, donde el grupo se
parte y el «tú» es deliberado.

**4.4 · Enlaces internos: uno por fichero y ancla**, en la primera mención que caiga en un `body`.
Más que eso satura.

**4.5 · Lo que no tiene ficha lleva enlace a Google Maps**, con **URL de búsqueda**
(`https://www.google.com/maps/search/?api=1&query=…`). **Nunca inventes coordenadas ni place IDs.**

**4.6 · Cada ficha de barrio de Tokio termina con «Lo que no sale en las listas»** — los *author
picks* y las rarezas de ese barrio. Antes vivían en una ficha «gemas» aparte y estorbaban.

**4.7 · Antes rotular nada que rotular mal.** Dos fichas siguen sin foto (Ebisu, Masakado) porque no
hay imagen libre verificable. Es la decisión correcta.

---

## 5. Herramientas del repo

```bash
npx vitest run tests        # LA puerta. 23 tests: esquemas, anclas, orders, subset inline
npx nuxi generate           # build estático a .output/public
node scripts/check-weight.mjs   # presupuesto: imagen ≤500 KB, total ≤15 MB, payload ≤550 KB gzip
node scripts/check-offline.mjs  # LA PUERTA DEL OFFLINE — mira el sw.js generado, no el contenido
```

`check-offline` es la lección del avión convertida en test. Comprueba que **toda** entrada del
precache existe como fichero (una sola que falle aborta el `addAll()` y deja el sitio sin service
worker), que está `ignoreURLParametersMatching` (sin él el payload con query de build no se
encuentra y sale un 500), que el `.wasm` de SQLite se precachea (es lo que lee el contenido) y que
el `navigateFallback` apunta a algo cacheado. **Corre en CI antes de desplegar.**

En `.claude/launch.json` está el servidor de desarrollo (`japon-dev`, puerto 3001). El sitio vive
bajo `/guiaJapon/`, así que hay que navegar a `http://localhost:3001/guiaJapon/`, no a la raíz.

**Los tres corren también en CI**, y en ese orden: `.github/workflows/deploy.yml` ejecuta
`test:unit && test:data` **antes** de `generate`, y el presupuesto de peso después. Un YAML inválido
no llega a producción en silencio. No es adorno: en guiaVietnam el despliegue corría solo el
`generate` y hubo que añadir la puerta a posteriori. Si tocas el workflow, no la quites.

### El escáner editorial

Vive fuera del repo (se regenera fácil): detecta variantes de un mismo topónimo, tipografía, tics
retóricos, **frases casi idénticas entre ficheros** y curiosidades que repiten su propio cuerpo.

**Aviso importante:** debe **descontar las URL antes de analizar**. Los topónimos van en ASCII dentro
de las consultas de Maps y sin ese filtro el escáner reporta once inconsistencias inexistentes
(«Engakuji» vs «Engaku-ji»…). Perdí un rato persiguiendo fantasmas.

---

## 6. Fotos

Pipeline: **API de Commons** (`User-Agent` obligatorio; usa `thumburl`, **nunca construyas URLs de
Wikimedia a mano** — son un MD5 y dan 404) → **hoja de contactos con `sharp`** para verlas todas de
un vistazo → descartar → **WebP 1200×800, calidad 70-72** en `public/img/{fichas,platos}/`.

Toda imagen lleva `credit` («Autor · Licencia») y `creditUrl` a la página de Commons. Solo licencias
CC o dominio público.

**Verifica siempre visualmente.** Las búsquedas devuelven cosas absurdas con nombres plausibles: para
«Ginza» salió un Mister Donut, para «Ueno» un grabado del siglo XIX y para «Ebisu» un grupo de idols.

Las fotos propias de Pablo van a `fotos-originales/` (gitignored) y su README lleva la lista viva de
lo que falta. **Una foto suya sustituye siempre a una de Commons.**

---

## 7. Fuentes

- **`The Rough Guide to Tokyo`** (EPUB propio). Extraer **el libro entero** con `zipfile` de Python,
  no capítulo a capítulo: la primera vez me quedé corto y me perdí los «author picks», los «Best of»
  por barrio y los recuadros temáticos, que es donde está lo bueno.
- **Export de Notion del viaje de 2024**: tablero de planificación con recortes de Japonismo y
  **capturas de páginas de Lonely Planet que hay que leer como imagen**. De ahí salen los
  restaurantes y la lista nacional del momiji.
- **Web del itinerario del grupo**: https://japanblastoisechan.vercel.app — es la fuente del plan
  día a día y de los hoteles.

Regla con las fuentes: **usar los datos, nunca copiar la prosa**. Y contrastar: el Rough dice que
Ieyasu construyó el castillo de Edo en 1497; lo empezó Ōta Dōkan en 1457.

**Aviso para quien llegue nuevo: ninguna de las dos primeras está en el repo**, y no puede estarlo
—el EPUB tiene derechos y el export de Notion son ficheros personales—. Es la diferencia grande con
el repo hermano `guiaVietnam`, que sí guarda su documento de referencia dentro
(`referencia-vietnam-camboya.md`, 185 KB) y con él se puede trabajar sin pedir nada a nadie. **Aquí
no.** Si vas a escribir contenido nuevo y no solo a corregir, **pídele a Pablo el EPUB y el export**;
sin ellos solo puedes trabajar sobre lo que ya está escrito, y el riesgo de inventar un dato que
suena bien es alto.

---

## 7 bis. Los repos hermanos

La plataforma es la misma en tres sitios y **las lecciones viajan entre ellos**:

- **`guiaVietnam`** — de donde salió este fork. Ahí está `NOTAS-MERGE-ROMA.md`, que acumula lo
  aprendido desplegando de verdad: que `better-sqlite3` necesita build nativo en CI
  (`onlyBuiltDependencies`), que GitHub Pages hay que pasarlo de `build_type: legacy` a `workflow`,
  que el CDN tarda un minuto largo en propagar y los *query params* no bustean su caché. Antes de
  pelearte con el despliegue, léelo.
- **`guiaRoma`** — su migración a Nuxt es el **PR #8, sin mergear**; el Roma vivo sigue siendo un
  `index.html` a pelo. Nada de aquí le afecta hoy.

Si arreglas aquí algo que sea de plataforma y no de contenido, **anótalo donde corresponda en el
otro repo**. Este fork existió porque nadie lo hizo a tiempo.

---

## 8. Estado y qué falta

**Hecho:** 21 días · 41 fichas en 9 zonas · 6 actos (al final del índice) · **24 platos y bebidas** ·
**62 locales en 10 ciudades** · 5 de salir · 10 recomendaciones prácticas · 56 fotos · PWA offline
completo.

**La capa gastronómica** se construyó con el mismo criterio que la de `guiaVietnam`: por ciudad y en
siete categorías (`desayuno · cafe · comida · cena · street-food · postre · cocteleria`), y **cada
ficha declara su fuente en `badge`**. Dos reglas que no hay que romper:

- **El `badge` es procedencia, no adorno.** Solo se escribe «Bib Gourmand», «Asia's 50 Best Bars» o
  un puesto de ranking **si está verificado**. Cuando no hay premio, el badge describe el porqué
  («Casa de 1465», «Inside Kyoto») en vez de inventar un galardón. Un badge falso envenena las 61
  fichas restantes.
- **`veg` es obligatorio y explícito, y en Japón no es trivial.** El problema no es la carne visible
  sino el ***dashi*** de bonito, que está debajo de la sopa de miso, de la salsa de la soba y del
  tempura — es decir, **de los platos que parecen vegetales**. Ningún `veg` debe decir solo «sí»:
  tiene que decir qué preguntar. La reco `veg-japon` lleva la frase en japonés.

**Falta:**
- Fotos propias de Shibuya, Ueno, Tsukiji e Hiroshima (Pablo las tiene sin subir).
- Sin foto verificable: Ebisu-Meguro y Masakado.
- Sin foto por decisión: las 13 comidas y 4 locales de «salir» — son establecimientos concretos y no
  hay forma de verificar que una imagen de Commons sea ese local.
- **El cuarto vuelo sin comprar** (vuelta el 13).
- **Y lo único que caduca: la noche del Shirakabaso en Kamikōchi.** El valle cierra el 15 de
  noviembre, el hotel el 14, las reservas abrieron en enero y **no hay plan B**.

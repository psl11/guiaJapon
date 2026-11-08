# Cómo trabajar en esta guía

Manual de operaciones para quien continúe este repo —persona o agente—. No repite lo que se ve
leyendo el código ni lo que ya cuenta la guía: recoge **las decisiones, las convenciones y las
trampas** que costaron tiempo descubrir.

---

## 0. Reglas de trabajo con Pablo

Las ha pedido él expresamente y no se deducen del código.

- **Commit y push directos a `main`**, sin ramas ni PR (`git push origin main`). La regla de «rama
  primero» es de los proyectos de Xceed, no de esta guía. En una sesión en la nube (Claude Code
  web o móvil), si el entorno no deja empujar a `main`, empuja a la rama de la sesión y dile que
  la mergee desde GitHub.
- **No hagas `curl` ni WebFetch contra tiendas y taquillas japonesas** (Webket/Shibuya Sky,
  Yodobashi, Bic Camera…). En oct 2026 una o dos peticiones bastaron para que bloquearan la IP de su
  casa. Para stock, horarios o entradas, usa WebSearch o pídele una captura.
- **No propongas que el hotel reserve un restaurante**, ni en la guía ni en las respuestas. El Gift
  Takayama dijo que no lo hace (nov 2026). Las alternativas son el teléfono (avisando si solo
  hablan japonés), una plataforma (TableCheck, Hot Pepper, byFood…) o llegar a la hora de apertura.
- **No se vuelve a ningún sitio**: ver §4.10.
- **Durante el viaje (6–26 nov) escribe desde el móvil.** Respuestas cortas y al grano. Lo que se
  empuja a `main` lo publica el CI en unos minutos; si no se ve, es la caché del service worker
  (trampa 3.5).

---

## 1. Qué es esto

Guía de viaje a Japón (**6–26 de noviembre de 2026**, 21 días, cuatro viajeros) publicada como sitio
estático en https://psl11.github.io/guiaJapon/. Bifurcada de `guiaVietnam`, que comparte plataforma.

**El dato que ordena todo el contenido:** **tres hacen los 21 días** y **uno vuela de vuelta el
sábado 14 de noviembre** (la jornada 9). Para tres es su primer viaje a Japón; para el cuarto, el
quinto. La guía cuenta el viaje entero y sirve a los dos lectores a la vez.

**Ese vuelo da forma al itinerario.** Sale de **Narita a las 12:10**, no de Haneda como los otros
tres, y no se coge desde los Alpes esa mañana: desde Takayama, el primer tren llega a Narita después
de que cierre el mostrador. Así que **la ruta sube a la montaña primero y vuelve a Tokio antes de la
despedida** (dos bucles; ver §8). Arrastra dos detalles: su maleta no viaja con las otras tres, y
**la fianza de la tarjeta IC no se devuelve en Narita**, solo en Haneda.

**En Tokio se duerme en tres barrios y en tres tandas**: **Akihabara** las dos noches de la ida
(6-7), **Roppongi** las cuatro de la escala (12-15) y **Ginza** las cinco últimas (21-25), en el
KOKO Ginza 1-chome. Ganó al APA Asakusa Kaminarimon porque deja Tsukiji, Ginza y la estación de
Tokio a pie; lo que cuesta es el madrugón de Nikkō. Durante meses la guía dijo **Shinjuku**, y se
descartó. **«Donde dormís» no es un sitio fijo**: antes de escribirlo, mira de qué bloque hablas.

---

## 2. Arquitectura

- **Nuxt 4** con `nuxi generate` → GitHub Pages (`nitro.preset: 'github_pages'`, `app.baseURL`).
- **@nuxt/content v3**, colecciones `type: 'data'` sobre YAML en `content/trips/japon/`.
- **Los esquemas viven en `shared/schemas.ts`**. Los consumen `content.config.ts` (tipos y columnas
  SQL) y los tests: una sola fuente de verdad.
- **PWA con precaché total** (`@vite-pwa/nuxt`), sin garantía de offline (trampa 3.9).

«Añadir un viaje = añadir ficheros»: los globs son `trips/*/…`, así que un viaje nuevo no toca código.

---

## 3. Trampas que ya han costado tiempo

**3.1 · Content v3 NO valida `type:'data'` contra zod en el build** (nuxt/content#3351). Un YAML mal
formado pasa el build y revienta en runtime. **La puerta real es `tests/data/schema.spec.ts`.**
Ejecuta siempre `npx vitest run tests` antes de dar nada por bueno.

**3.2 · Hay campos que NO renderizan Markdown.** `epithet`, `lead`, `lede`, todos los `title`, los
`sections[].heading` y `traslados[].medio`/`nota` van por `inlineMd`, que solo entiende `**fuerte**`,
`*cursiva*` y `` `código` ``. **Un enlace ahí sale como texto crudo**: los enlaces van en los `body`.
Lo vigila `tests/data/inline-md-subset.spec.ts`.

**3.3 · `id` y `meta` son nombres reservados de Content v3.** Por eso el ancla es `slug`, el hero
usa `heroMeta` y las recomendaciones usan `note`.

**3.4 · Los tests validan datos, no vista.** Al bifurcar de guiaVietnam, `TripView.vue` seguía
filtrando por `part === 'vietnam'` y **no se renderizaba nada en la web publicada**, con todos los
tests en verde. **Después de cualquier cambio estructural, abre el sitio y cuenta lo que sale.**

**3.5 · El service worker sirve caché vieja.** Si parece que el despliegue no ha entrado, antes de
diagnosticar nada: `navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.keys()` →
`delete()`.

**3.6 · YAML: un valor con dos puntos necesita comillas.** `title: Lo primero: soltar el equipaje`
rompe el parser, y el error (`Nested mappings…`) no señala la causa.

**3.7 · `zone` debe ser contigua y `order` único** por (colección · part). Si insertas una ficha en
medio, **renumera todo el bloque**.

**3.8 · `<MDC>` emite bloque; en contexto inline rompe la hidratación.** Dentro de un `<h2>` o un
`<p>` mete un `<div>` donde no cabe, y el cliente deja de coincidir con el servidor (en guiaVietnam:
pull-quotes que perdían su clase al hidratar, sin error visible). **`<MDC>` solo dentro de su propio
`<div>`; todo lo inline por `inlineMd()`** (`app/utils/inline-md.ts`). Es lo primero que hay que
mirar en un componente de tarjeta nuevo.

**3.9 · El offline ya no es requisito (sep 2026)** y nada lo vigila: puede romperse en silencio, y
está aceptado. Se retiraron las puertas `check-offline` y `check-weight`. Los tres fixes siguen en
`nuxt.config.ts` y no hay que quitarlos:

1. `globIgnores: ['**/200.html', '**/404.html']`. Workbox los metía sin extensión, una petición
   fallaba y `addAll()` abortaba la instalación entera del SW.
2. `ignoreURLParametersMatching: [/.*/]`. Nuxt pide `_payload.json?<uuid>` y offline daba un 500.
3. `wasm` en `globPatterns`, porque Content v3 lee el contenido con SQLite en WASM.

La única prueba que vale, si vuelve a importar: `npx nuxi generate`, servir `.output/public` bajo el
subpath, esperar al SW `active`, **matar el servidor** y recargar.

**3.10 · `white-space: nowrap` + `flex-shrink: 0` en un chip con texto libre saca scroll
horizontal en móvil** (37 px a 375 px en la gastronomía, invisible en escritorio). Solo es seguro si
además trunca (`text-overflow: ellipsis`, como `.gi-label`). La otra mitad es la prosa con tokens
indivisibles (URLs largas): por eso hay `overflow-wrap: break-word` global en `p, li, td…`. Lo vigila
`tests/unit/cssOverflow.spec.ts` de forma estática; **la medición de verdad es en el navegador a 320
y 375 px**, contando elementos con `scrollWidth > clientWidth`. Hazlo siempre que toques una tarjeta.

**3.11 · YAML plegado y Markdown no cuentan igual los saltos de línea.** En `body: >-`, una línea
en blanco da un solo `\n` (párrafos fundidos) y dos viñetas seguidas se pliegan en una. Estuvo
publicado así en 39 ficheros.

- **Entre párrafos, dos líneas en blanco.** Entre viñetas, una.
- **Si el texto lleva sangrías** (listas con continuación, numeradas largas), en literal `|-`.

Lo vigila `tests/data/folded-scalars.spec.ts`, que lee el YAML crudo.

**3.12 · Al renumerar días, la prosa no se renumera sola.** El `eyebrow` dice la fecha, pero el
cuerpo dice «el lunes», «mañana es domingo»… y los tests no lo cazan: son datos válidos que dicen
mentiras. Ya pasó tres veces (un día 20 entero colgado de los cierres de los lunes cuando era
miércoles). Tras renumerar: `grep -n "lunes\|martes\|domingo\|víspera\|mañana es"` sobre `dias/` y
mirarlo uno a uno. **Cómo se renumera:** cargar todos los ficheros en memoria, aplicar el mapa,
borrar el directorio y reescribir, sustituyendo en la misma pasada las anclas `#dia-…` en todo
`content/`. Remapea «día N» en la prosa **antes** de reescribir nada a mano, no después.

---

## 4. Convenciones editoriales

**4.1 · El día dice QUÉ SE HACE; la ficha dice QUÉ ES.** Es la regla que más trabajo ha dado: hubo
141 fragmentos idénticos entre el día 15 y la ficha de Hiroshima. Si te descubres explicando historia
dentro de un día, **enlaza a la ficha y borra**.

**4.2 · El tono: que el dato lleve el peso, no la tipografía.** Registro de reportaje —*National
Geographic*, no folleto—. Medido sobre la prosa parseada (no sobre el texto plano, que concatena
viñetas): 20,7 palabras por frase de media, p90 de 37, 28,4 negritas por mil.

- **Una negrita por párrafo en la narración** (actos, fichas, cuerpo de los días). Un dato bueno no
  la necesita.
- **En las tarjetas prácticas sí es funcional** (recos, `quePedir`, ventanas): se leen en diagonal.
- **Una lista es una lista**, no una enumeración con punto y coma dentro de un párrafo.
- **El guion largo no sustituye al punto.** Si un inciso puede ser una frase, mejor frase.

**4.3 · «El día N» es siempre la jornada del viaje.** Las fechas del calendario llevan el mes o el
día de la semana: «el viernes 13», «el 14 de noviembre». Mezclarlo ya produjo errores reales.

**4.4 · Voz en segunda del plural** («vais», «conviene que»), salvo en los días `solo-*` (2-6
nov), que son del cuarto viajero y van en «tú».

**4.5 · Enlaces internos: uno por fichero y ancla**, en la primera mención que caiga en un `body`.

**4.6 · Lo que no tiene ficha lleva enlace a Google Maps** con URL de búsqueda
(`https://www.google.com/maps/search/?api=1&query=…`). **Nunca inventes coordenadas ni place IDs.**

**4.7 · Antes no rotular que rotular mal.** Dos fichas siguen sin foto (Ebisu, Masakado) porque no
hay imagen libre verificable. No se inventa ningún establecimiento, premio ni dato.

**4.8 · El día dice qué se hace; `traslados` dice cómo se llega.** Pinta una tarjeta índigo en la
cabecera (desde/hasta, medio, duración, hora, nota).

- **`hora` es recomendación, no horario**: «salir 09:00», nunca «09:04».
- **`medio` y `nota` no admiten enlaces** (3.2). El porqué del trayecto va en el `body`.
- **«Hoy se duerme en»** sale del campo `duerme`, una lista de slugs de `hoteles/`. Al renombrar un
  hotel, actualiza los `duerme` (los caza `schema.spec.ts`).
- La fila de metadatos se salva del scroll (3.10) por `flex-wrap: wrap` en la fila y `min-width: 0;
  overflow-wrap: break-word` en las celdas. No les quites ninguna de las dos.

**4.9 · El día es el hilo que lo conecta todo.** Cada bloque lleva dos listas **por referencia**:

- **`ver`**: una ficha (`ficha: slug`), un recomendado (`reco: slug`, que apunta a
  `recomendados/`, **no** a `recos/`) o un sitio sin ficha (`nombre` + `maps` + `lat/lon` si hay
  fuente).
- **`comer`**: slugs de `comidas/`. La tarjeta gana sola el chip «En el plan: día N». **Uno por
  bloque lleva `elegido: true`** (lo exige `schema.spec.ts`), el único con letra en el mapa; el resto
  sale como alternativa.

Cada uno con una `nota` de una línea (inlineMd). El cuerpo del bloque se queda en lo que se hace y en
qué orden: si repite una `nota`, sobra el cuerpo. El campo `cuando` de las comidas es redundante y se
desfasa al renumerar: al tocarlo, quítale el número de día.

**Coordenadas, de una fuente verificable**, de más a menos fiable:

- La dirección postal geocodificada en el GSI
  (`https://msearch.gsi.go.jp/address-search/AddressSearch?q=<dirección>`).
- Las coordenadas de la ficha del local en Google Maps (el pin, no la búsqueda), Tabelog,
  SavorJapan o Gurunavi.
- OpenStreetMap, comprobando que la dirección devuelta es la del local.

La ubicación etiquetada en Instagram no vale sola. **Nunca a ojo**: sin fuente cierta, sin
coordenadas (sale en la lista, no en el mapa). Lo que cae a más de 2,5 km de cualquier parada sale
sin letra. Tras tocar `ver`, `comer` o coordenadas, corre `node scripts/build-routemap.mjs`.

**4.10 · No se vuelve a ningún sitio** (decisión del grupo, sep 2026: «hay mucho que ver y gestionar
para repetir lugares»). Lo que guste se compra al pasar (lo que pese, por *takkyūbin*). **Las compras
grandes y los regalos van al final**, el día 17, en un barrio que el viaje no pisa antes
(Ikebukuro). Nada de «hoy se cruza X y el día N se vuelve». Antes de añadir un sitio a un día:
`grep -rn "<sitio>" content/trips/japon/dias/`.

**4.11 · Cada ficha de barrio de Tokio termina con «Lo que no sale en las listas»**: los *author
picks* y las rarezas de ese barrio.

**4.12 · Las renuncias no se borran.** Lo que se descartó se cuenta en `el-mapa-del-viaje` o en su
`inversion`, aunque la decisión ya no exista (p. ej. `dormir-en-kamikochi`), porque explica el porqué
a quien lea la guía.

**4.13 · Atribución.** Lo que viene de alguien lo dice:

- Las comidas llevan `fuente` (`alba` | `pablo`) y `fuenteUrl`. **`pablo` es Pablo Sánchez**, no
  Pablo Velasco, que hizo la capa de Alba. Una comida sin `fuente` no sale en Recomendados. El chip
  dice quién la trajo, no qué premio tiene.
- `FichaSchema` también tiene `fuente` (las cuatro fichas de la noche de Shinjuku son de Pablo).
- Lo que sale de los reportajes de *National Geographic* que pasó Pablo (los Alpes en otoño, de
  2021; los jazz kissa, de marzo de 2026) **dice de dónde viene**. Lo pidió expresamente.

---

## 5. Herramientas

```bash
npx vitest run tests             # LA puerta: esquemas, anclas, orders, subset inline, YAML plegado, CSS
npx nuxi generate                # build estático a .output/public
node scripts/build-routemap.mjs  # hornea los mapas de `ruta` (bloque) y `mapa` (día)
```

- **`ruta`** en un bloque (`slug`, `desde`, `hasta` con lat/lon de fuente) pinta el recorrido a pie
  y un enlace a Maps **por coordenadas** (por nombre, Maps resolvía «Chuo-dori» a 3 km).
- **`mapa`** en un día pinta las paradas numeradas (la primera, el hotel, con «S»), las zonas y
  cómo se llega a cada parada (`llegada`: `a-pie`, `metro`, `tren`).
- Sin correr el script tras tocarlos, el bloque o el día sale sin mapa.
  Las claves de `routeMapsGeo.js` son las que calcula el script (`reco:…`, etc.).
- **Servidor de desarrollo:** `.claude/launch.json` (`japon-dev`, puerto 3001). Navega a
  `http://localhost:3001/guiaJapon/`, no a la raíz.
- **CI:** `.github/workflows/deploy.yml` corre `test:unit && test:data` **antes** de `generate`. Si
  tocas el workflow, no quites esa puerta.

**Herramientas fuera del repo** (`tools/` está en el `.gitignore`): el escáner editorial y el
extractor de Instagram.

- **El escáner editorial** detecta variantes de topónimos, tics y frases casi idénticas entre
  ficheros. **Debe descontar las URL**: los topónimos van en ASCII dentro de las consultas de Maps y
  dan falsas inconsistencias.
- **El extractor de Instagram** (un solo uso; guardaba una cookie de sesión). Si hay que repetirlo:
  1. El mensajero de 2026 llega por `/api/graphql`, con `slide_messages.edges[].node` y
     `message_id` / `content_type` / `timestamp_ms`. El esquema clásico (`item_id`…) da cero
     mensajes.
  2. El número de `/direct/t/<n>` no es el `thread_fbid`, y la bandeja precarga otros hilos: pasa el
     hilo explícito.
  3. El `xma` trae el caption vacío. Se rehidrata con `/api/v1/media/<pk>/info/`.
  4. Para paginar se reemite la propia petición subiendo el tamaño de página, porque el `doc_id`
     cambia cada semana.

---

## 6. Fotos

Pipeline: **API de Commons** (`User-Agent` obligatorio; usa `thumburl`, **nunca construyas URLs de
Wikimedia a mano**) → hoja de contactos con `sharp` → descartar → **WebP 1200×800, calidad 70-72** en
`public/img/{fichas,platos}/`. Toda imagen lleva `credit` («Autor · Licencia») y `creditUrl`. Solo CC
o dominio público.

- **Verifica siempre visualmente**: para «Ginza» salió un Mister Donut y para «Ebisu» un grupo de
  idols.
- Las fotos propias de Pablo van a `fotos-originales/` (gitignored, con README de lo que falta).
  **Una foto suya sustituye siempre a una de Commons.**
- Las comidas y los locales de «salir» van sin foto a propósito, porque no se puede verificar que la
  imagen sea ese local.
- Las portadas de discos tampoco van, porque tienen derechos: llevan un «Ver la portada» a Discogs.

---

## 7. Fuentes

- **`The Rough Guide to Tokyo`** (EPUB). Extrae **el libro entero** con `zipfile`: lo bueno está en
  los «author picks», los «Best of» y los recuadros.
- **Export de Notion del viaje de 2024**, con capturas de Lonely Planet que hay que leer como imagen.
- **Web del itinerario del grupo**: https://japanblastoisechan.vercel.app.
- **Japonismo**: útil, pero con datos viejos. Ya ha dado fechas de 2023 como si fueran de 2026 (el
  *tori no ichi* es el 7 y el 19), un festival de Kawaguchiko con días equivocados (2026: del 7 al
  29), un museo cerrado en 2021 (Hara) y un *onsen* en el barrio equivocado. Contrasta siempre.

**Usa los datos, nunca copies la prosa, y contrasta.** El Rough dice que Ieyasu construyó el castillo
de Edo en 1497; lo empezó Ōta Dōkan en 1457.

**El EPUB y el export no están en el repo** (derechos y ficheros personales). Para escribir
contenido nuevo, y no solo corregir, **pídeselos a Pablo**: sin ellos el riesgo de inventar un dato
que suena bien es alto.

**Repos hermanos.** `guiaVietnam` (de donde sale el fork) tiene `NOTAS-MERGE-ROMA.md` con lo
aprendido desplegando: `better-sqlite3` necesita build nativo en CI, GitHub Pages en `workflow` y no
en `legacy`, y el CDN tarda en propagar. Si arreglas aquí algo de **plataforma**, anótalo también
allí.

---

## 8. Por qué el itinerario tiene esta forma (no «arreglar» sin leer)

**La reforma de agosto de 2026.** El vuelo del cuarto (sábado 14, 12:10, Narita) hacía imposible
estar en los Alpes ese fin de semana. Se descartó ir y volver a Matsumoto, que eran siete horas más.
Se adoptó **volver a Tokio desde Kanazawa** (Hokuriku Shinkansen) en vez de bajar a Kioto: cuesta
+2 h 40 y ~¥21.000 por persona, y a cambio la despedida es en un hotel de Tokio. Las decisiones que
cuelgan de ahí:

- **Kamikōchi es un día de ida y vuelta** desde Matsumoto, y **se duerme en Hirayu Onsen**, no en
  Takayama: caben tres baños en vez de uno. El día que se ahorró se fue a Nara, que luego se quitó.
  Desde el 8 nov el día empieza en la terminal, no en el estanque Taishō: las mochilas se dejan en
  la consigna del centro de información (6:00-17:00) y el valle se anda sin peso, primero río
  arriba hasta Myōjin y por la tarde río abajo hasta Taishō. Lo pidió el grupo.
- **La trampa de los autobuses:** el último Kamikōchi→Hirayu sale a las **17:30**, y el último
  Hirayu→Takayama, también a las 17:30. Quien quiera llegar a Takayama esa noche tiene que salir del
  valle hacia las 16:00.
- **Nikkō se queda en el día 19.** Se movió al 9 por el momiji y fue un error: su parte alta tiene
  el color en octubre, y el día 9 es sábado. La ficha del momiji explica el descarte.
- **El Fuji del 23 está contratado** con Turismo Victoria: recogida en **Shin-Fuji a las 8:30**,
  donde solo para el **Kodama**. Es una excursión guiada, así que las paradas se le piden al guía.

**Nara fuera, domingo en Tokio dentro** (ago 2026, decisión del grupo). Quitar un día en Kansai y
meter uno en Tokio no movió nada del 20 de noviembre en adelante. Kioto tiene cuatro noches de verdad
y el Shinkansen de bajada va en lunes. La ficha de Nara se borró y sus enlaces pasaron a texto plano.
**Ya no queda día comodín: meter algo obliga a quitar algo.**

**Kamakura y la Yamanote se intercambiaron** (oct 2026). La Yamanote es el viernes 13, con los cuatro
(día 8), y Kamakura el sábado 14 (día 9), porque el cuarto ya hace su propio Kamakura el martes 3
(`solo-2-kamakura`, con otra ruta). El día del *yabusame* se borró para que no repitiera Meiji Jingū.

**Kioto: el oeste el 12 y el este el 13** (ago 2026). Los dos Nenbutsu-ji de Saga-Toriimoto cierran
los miércoles, y el día de Arashiyama era miércoles. Todo lo demás de Kioto abre a diario. Subir a
Saga-Toriimoto va escrito como decisión, no como plan: cuesta el Ninna-ji.

**Hiroshima, el Via Inn Prime Shinkansen-guchi** (sep 2026): las tres citas del día 16 salen del paso
libre de la estación. Lo único que tumba el argumento es la consigna de siete horas y media tras el
*check-out*, y la ficha dice que hay que preguntarla.

**El día 6 se rehízo por los autobuses** (oct 2026): los de la mañana y los directos de la tarde
estaban agotados. Están comprados el de las 13:20 a Shirakawa-gō y el de las 17:20 a Shin-Takaoka.

**Los días del cuarto** (`solo-*`, 2-6 nov). **Es su quinta visita**: nada de lo obvio, poca
naturaleza (ya tiene los Alpes con el grupo), y Nikkō, el Fuji y Yokohama están descartados. El
viernes 6 recoge a los otros tres en Haneda.

**El miércoles 4 se rehízo sobre la marcha** (4 nov, ya en Tokio), con lo que recomendó su familia.
`solo-3-ginza` conserva el slug, pero el día es de Kanda:

- un Ippudo de camino;
- Jinbōchō, con Italia Shobō, la de los libros en español;
- Ochanomizu y el Kanda Myōjin al atardecer;
- la maleta de la taquilla de Shimbashi, justo antes del *check-in*;
- Kagurazaka de noche y el New York Bar con jazz y hamburguesa.

Lo que el día tenía antes (Daikanyama, Hachigō, el Seiko, los vinilos de Shibuya) está en su `alt`.
El HCC005J de su padre pasó a `compras` y el *Sakura* de Yokota a `vinilos`. Para no repetir, el
viernes 6 perdió Jinbōchō y el New York Bar y ganó el Intermediatheque con KITTE. El jueves 5 se
queda con Kawagoe: la familia dijo que no compensa, y Pablo decidió mantenerlo.

**Lo que ya está comprado** (trenes, autobuses, reservas) lleva su número en el día o en la ficha
del hotel. No lo cambies sin que Pablo lo diga.

---

## 9. Las capas de contenido y sus reglas

**Gastronomía**: por ciudad y en siete categorías (`desayuno · cafe · comida · cena · street-food ·
postre · cocteleria`). **El `badge` es procedencia, no adorno.**

- «Bib Gourmand», «Asia's 50 Best Bars» o un puesto de ranking, solo si está verificado. Si no hay
  premio, el badge dice el porqué («Casa de 1465»).
- **Los Bib Gourmand llevan el año.** Tokio y Kioto-Osaka tienen guía anual. Kanazawa (2016) e
  Hiroshima (2013) solo tuvieron ediciones especiales. Kamakura, Matsumoto, Takayama y Nikkō no
  tienen guía. Antes de añadir uno, verifica que sigue en la edición vigente.
- **No hay vegetarianos en el viaje.** El campo `veg` sigue en el esquema, opcional y sin pintar.
  Describir de qué está hecho un plato es interesante; advertir a alguien que no viene, no.

**Recomendados por el grupo** (`recomendados/`, ago 2026), a partir de 422 posts que Alba compartió
por Instagram.

- Un local de comer es una `comida` con `fuente`. Lo que no es restaurante (un mercado, un taller,
  un aviso de estafa) va a `recomendados/` con `kind` (`ver` · `taller` · `truco`) y `url`
  obligatorio. `recos/` es otra cosa: la logística del viaje.
- **La sección no duplica nada**: lista los locales en una línea que salta a su ficha.
- **Verificar antes de escribir, y escribir la corrección.** Más de quince contradecían su propio
  vídeo (aforos, estrellas perdidas, cajeros…).
- **Cuando algo no encaja, se dice.** Hay fichas que existen para explicar por qué NO se va
  (Onigiri Bongo, Okudosan…), y lo no confirmado va escrito como tal.

**Las películas del grupo** viven en la ficha `peliculas-del-grupo`, con los sitios como `ver` en su
día. Las que no pisan la ruta lo dicen, y lo que no se pudo verificar se descartó.

---

## 10. Pendiente

- **Mapas sin hornear**, por falta de red hacia OSM o el GSI cuando se escribieron:
  - el día 8 no lleva Shin-Ōkubo, y Yopu no tiene coordenadas;
  - el día 5 no tiene `mapa` (va con dos zonas: el casco de Takayama y Furukawa);
  - `solo-2-kamakura` y `solo-3-ginza` no tienen `mapa`;
  - el de `solo-5-fukagawa` se editó a mano en `routeMapsGeo.js` para quitar la parada de Jinbōchō
    (4 nov), y la imagen sigue siendo la vieja;
  - el del día 4 se reordenó a mano (8 nov): las paradas y los tramos a pie son los de antes,
    invertidos, y el estanque Taishō → terminal es una recta de autobús. Rehornéalo cuando haya red;
  - varios `ver` de la tanda de Japonismo no tienen coordenadas.
- **Fotos**: Pablo tiene sin subir las de Shibuya, Ueno, Tsukiji e Hiroshima. Ebisu-Meguro y
  Masakado siguen sin foto verificable. El King Seiko y el Grand Seiko del cuarto dependen de fotos
  de Pablo, y además `RecoSchema` no tiene `image` (habría que añadirlo y usar `CardPhoto` en
  `RecoCard`).
- **Sin confirmar, y las tarjetas lo avisan**:
  - los horarios de noviembre de los autobuses de Kamikōchi (el día 4 cuelga de dos);
  - los horarios de las dos Disk Union;
  - Slow Hand;
  - si el jazz kissa Genius sigue abierto;
  - si Brooch Asakusa es de verdad una Core Shop de Seiko (no está en la lista oficial consultada);
  - si la hamburguesa del New York Bar sigue en la carta desde la reforma.

# Cómo trabajar en esta guía

Manual de operaciones para quien continúe este repo —persona o agente—. No repite lo que se ve
leyendo el código: recoge **las decisiones, las convenciones y las trampas** que costaron tiempo
descubrir.

---

## 1. Qué es esto

Guía de viaje a Japón (**6–26 de noviembre de 2026**, 21 días, cuatro viajeros) publicada como sitio
estático en https://psl11.github.io/guiaJapon/. Bifurcada de `guiaVietnam`, que comparte plataforma.

**El dato que ordena todo el contenido:** el grupo son cuatro, **tres hacen los 21 días** y **uno
vuela de vuelta el sábado 14 de noviembre** (la jornada 9). Para tres es su primer viaje a Japón;
para el cuarto, el quinto. La guía cuenta el viaje entero y sirve a los dos lectores a la vez.

**Y ese vuelo es lo que da forma a todo el itinerario, así que conviene entenderlo antes de tocar
nada.** Sale de **Narita a las 12:10**, no de Haneda como los otros tres. Un vuelo de mediodía no se
coge desde los Alpes esa mañana —se comprobó: desde Takayama, el primer tren del día llega a Narita
después de que cierre el mostrador—, así que **la ruta sube a la montaña primero y vuelve a Tokio
antes de la despedida**. De ahí la forma en dos bucles, y de ahí que el grupo se separe en un hotel
de la capital y no en una parada de autobús de montaña. Arrastra además dos detalles por el
contenido: su maleta no viaja con las otras tres, y **la fianza de la tarjeta IC no se devuelve en
Narita**, solo en Haneda.

**Y un dato que toca muchos ficheros: en Tokio se duerme en dos barrios y en tres tandas.**
**Akihabara** las dos noches de la ida (6-7) y las tres de la escala (12-14); **Shinjuku** las cinco
últimas (21-25). No es casual —la ventaja de Shinjuku es la noche, y la noche no se usa con jet
lag— pero significa que **«donde dormís» no es un sitio fijo**: antes de escribir esa expresión,
mira de qué bloque hablas.

---

## 2. Arquitectura, en cuatro líneas

- **Nuxt 4** con `nuxi generate` → GitHub Pages (`nitro.preset: 'github_pages'`, `app.baseURL`).
- **@nuxt/content v3**, colecciones `type: 'data'` sobre ficheros YAML en `content/trips/japon/`.
- **Los esquemas viven en `shared/schemas.ts`** y los consumen dos sitios: `content.config.ts` (tipos
  y columnas SQL) y los tests. Una sola fuente de verdad.
- **PWA con precaché total** (`@vite-pwa/nuxt`): app shell, contenido y las 56 fotos, ~13 MB.

«Añadir un viaje = añadir ficheros»: los globs son `trips/*/…`, así que un viaje nuevo no toca código.

---

## 3. Las diez trampas que ya nos han costado tiempo

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

**3.10 · `white-space: nowrap` + `flex-shrink: 0` en un chip con texto libre saca scroll
horizontal en móvil.** La pareja le dice al elemento que **no puede partir línea NI encoger**, así
que un valor largo —«Uno de los tres grandes mercados matinales de Japón» en un `badge`— estira su
fila flex por encima del ancho de la pantalla. En la gastronomía sacaba **37 px de scroll** a 375 px
y no lo veía nadie porque **en escritorio no pasa**. Solo es seguro si además trunca
(`text-overflow: ellipsis`), que es lo que hace `.gi-label`.

La otra mitad del mismo problema es la prosa: un token indivisible más ancho que su columna
—`ticket.angkorenterprise.gov.kh`, 236 px en una de 209— rompe la caja igual. Por eso hay una regla
global de `overflow-wrap: break-word` en `p, li, td…`.

**Lo vigila `tests/unit/cssOverflow.spec.ts`**, que comprueba la causa de forma estática (jsdom no
calcula layout, así que no puede medir el desbordamiento). **La medición de verdad es en el
navegador a 320 y 375 px**, contando elementos cuyo `scrollWidth > clientWidth` o cuyo borde derecho
pasa del viewport. Hazlo siempre que toques una tarjeta.

---

## 4. Convenciones editoriales

Estas no son gusto: son las reglas que mantienen la guía coherente y sin repeticiones.

**4.1 · El día dice QUÉ SE HACE; la ficha dice QUÉ ES.** Es la regla que más trabajo ha dado. Al
escribir los días 9-21 desde el mismo material que las fichas se duplicaron párrafos enteros —141
fragmentos idénticos entre el día 15 y la ficha de Hiroshima— y hubo que reescribir diecisiete
bloques. Si te descubres explicando historia dentro de un día, **enlaza a la ficha y borra**.

**4.1 bis · El tono: que el dato lleve el peso, no la tipografía.** La guía busca registro de
reportaje —*National Geographic*, no folleto—. Medido sobre las 59.000 palabras de prosa, con el
analizador que parsea el YAML de verdad (ojo: contar sobre el texto plano miente, porque concatena
las viñetas y da frases fantasma de 120 palabras):

| | guía | referencia |
|---|---|---|
| palabras por frase, media | **20,7** | 15–20 |
| p90 | **37** | ~30 |
| negritas por 1.000 palabras | **28,4** | cuantas menos, mejor |

Las reglas que salen de ahí:

- **Una negrita por párrafo en la narración** (actos, fichas, cuerpo de los días). Si todo está en
  negrita, nada lo está: se pasó de 38,2 a 28,4 por mil retirando 578. **Un dato bueno no necesita
  negrita** — «un tsunami se la llevó en 1498» se sostiene solo.
- **En las tarjetas prácticas sí es funcional** (recos, `quePedir`, ventanas): ahí se lee en
  diagonal buscando la acción, y la negrita es la que la señala. Por eso `recos` va a 46 por mil
  a propósito.
- **Una lista es una lista.** Varias de las frases más largas eran enumeraciones metidas en prosa
  con punto y coma. En viñetas se leen; en un párrafo de 100 palabras, no.
- **El guion largo no sustituye al punto.** Van 14,4 por mil, que es uno cada setenta palabras.
  Cuando un inciso pueda ser una frase aparte, mejor frase aparte.

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

**4.8 · El día dice qué se hace; el nodo de traslados dice cómo se llega.** Es la regla 4.1 aplicada
al transporte, y es nueva (ago 2026). El campo `traslados` de cada día pinta una tarjeta en índigo en
la CABECERA —desde/hasta, medio, duración, hora recomendada, nota— que se consulta la víspera de un
vistazo. Tres cosas que hay que respetar al escribirlo:

- **`hora` es recomendación, no horario.** Los horarios de 2026 no están publicados y los autobuses
  de montaña cambian en noviembre. Se escribe «salir 09:00», nunca «09:04».
- **`medio` y `nota` van por `inlineMd`: no admiten enlaces** (trampa 3.2). El porqué del trayecto,
  con sus enlaces, sigue yendo en el `body` del bloque que lo cuenta. Lo vigila
  `tests/data/inline-md-subset.spec.ts`, que ya los tiene declarados.
- **La fila de metadatos es un flex con tres celdas de texto libre**, o sea exactamente la forma que
  sacó 37 px de scroll en la gastronomía (trampa 3.10). Está a salvo por `flex-wrap: wrap` en la fila
  y `min-width: 0; overflow-wrap: break-word` en las celdas, y **hay un test que lo sostiene** en
  `cssOverflow.spec.ts`. Si tocas ese CSS, no le quites ninguna de las dos.

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

**Hecho:** 21 días · 41 fichas en 9 zonas · 6 actos (al final del índice) · 24 platos y bebidas ·
58 locales en 9 ciudades · 5 de salir · 9 recomendaciones prácticas · 65 fotos · PWA offline
completo y verificado.

**La capa gastronómica** se construyó con el mismo criterio que la de `guiaVietnam`: por ciudad y en
siete categorías (`desayuno · cafe · comida · cena · street-food · postre · cocteleria`), y **cada
ficha declara su fuente en `badge`**. Dos reglas que no hay que romper:

- **El `badge` es procedencia, no adorno.** Solo se escribe «Bib Gourmand», «Asia's 50 Best Bars» o
  un puesto de ranking **si está verificado**. Cuando no hay premio, el badge describe el porqué
  («Casa de 1465», «Inside Kyoto») en vez de inventar un galardón. Un badge falso envenena las 61
  fichas restantes.
- **En este viaje NO hay vegetarianos** y la guía no debe comportarse como si los hubiera. Se montó
  la capa entera —campo `veg` en las 86 fichas, una reco sobre el *dashi*, tres locales veganos y un
  bloque de «no aptos»— arrastrando el contexto de `guiaVietnam`, donde sí es central. Se retiró:
  `veg` quedó **opcional en el esquema y sin pintar** en las tarjetas. Si alguna vez viaja alguien
  vegetariano, el campo sigue existiendo y basta con volver a renderizarlo.

  Lo que **sí se queda**, porque es cultura y no advertencia: la [shōjin ryōri](#) como cocina de
  monasterio —con Shigetsu dentro del Tenryū-ji, Ajiro con estrella e Izusen en Daitoku-ji—, el
  *dashi* como ingrediente y el *wagashi* explicado por sus tres ingredientes. La regla al escribir:
  **describir de qué está hecho un plato es interesante; advertir a alguien que no viene, no.**

**Falta:**
- Fotos propias de Shibuya, Ueno, Tsukiji e Hiroshima (Pablo las tiene sin subir).
- Sin foto verificable: Ebisu-Meguro y Masakado.
- Sin foto por decisión: las 13 comidas y 4 locales de «salir» — son establecimientos concretos y no
  hay forma de verificar que una imagen de Commons sea ese local.
- **Los hoteles están sin rehacer, y es deliberado.** El itinerario cambió de forma entera (ver
  abajo) y las camas de Takayama, Kanazawa, Kioto, Hiroshima y las tres tandas de Tokio hay que
  volver a buscarlas. En `hoteles/` solo se han ajustado los campos `noches` para que no mientan;
  **no se ha inventado ningún establecimiento**, que es la regla 4.7. Es la siguiente tarea grande.
- **Los horarios de autobús de noviembre en Kamikōchi, sin confirmar.** Todo el día 4 cuelga de dos
  autobuses y los horarios usados son los de temporada general.

---

## 9. La reforma de agosto de 2026: por qué el itinerario tiene esta forma

Si llegas nuevo y el plan te parece raro —¿por qué la montaña casi de entrada, si el jet lag se paga
mejor en una ciudad?— la respuesta está aquí, y conviene leerla antes de «arreglar» nada.

**El desencadenante fue el cuarto vuelo.** Se compró para el **sábado 14 a las 12:10 desde Narita**,
y eso rompió el itinerario anterior, que tenía al grupo en los Alpes ese fin de semana. Se comprobó
con horarios reales: desde Takayama, el primer Hida sale a las 06:45 y se llega a Narita hacia las
12:00 — una hora después de que cierre el mostrador. **No era apretado, era imposible.**

Se evaluaron dos formas antes de elegir. La primera —ida y vuelta a Matsumoto dejando Hida y
Kanazawa para después— añadía **siete horas** de transporte y se descartó. La que se adoptó mantiene
los Alpes y el Hida enteros y en orden, y solo cambia la puerta de salida: **se vuelve a Tokio desde
Kanazawa** (Hokuriku Shinkansen, 2 h 30) en vez de bajar a Kioto. Cuesta **+2 h 40 y ~¥21.000 por
persona**, y a cambio:

- La despedida ocurre en un hotel de Tokio, no en un cruce de carreteras de montaña.
- **Los barrios grandes de Tokio se reparten mejor.** La Yamanote —Meiji Jingū, Harajuku, Shibuya—
  cae el **sábado 14**, que es la víspera del *shichi-go-san*: el mejor fin de semana del año para
  estar en Meiji Jingū, y salió por casualidad. Y Tsukiji, Ginza y el día de compras se van al
  final (22-25), al pico de la hoja roja.

**Y una cosa que se movió y se devolvió, para que no la vuelva a mover nadie:** durante la reforma
Nikkō se pasó al día 9 argumentando su momiji. **Fue un error y está deshecho.** Su parte alta
—Chūzenji, Irohazaka— tiene el color en **octubre**, así que adelantarlo del 24 al 14 no la salva:
solo gana unos días en la zona baja del Tōshōgū, y a cambio lo pone en **sábado**, que en uno de los
santuarios más visitados del país es un mal cambio. Nikkō se queda en el **día 19**, donde estaba, y
la ficha del momiji explica el descarte en vez de callarlo.

**El segundo cambio fue Kamikōchi, y salió de un problema.** Las camas del valle estaban vendidas
—sus reservas abren en enero—, así que el plan original de **entrar dos veces al valle con una noche
en medio dejó de tener sentido**: la segunda entrada solo existía para amortizar la noche de dentro.
Sin ella es un día de ida y vuelta y punto. Se comprimió a una jornada larga —Matsumoto → valle
entero de punta a punta— y eso ahorró un día del itinerario, que se fue a Nara.

**Y se duerme en Hirayu Onsen**, no en Takayama. Esto se probó de las dos maneras y la diferencia
importa: bajando de paso cabe **un** baño con el reloj puesto; durmiendo allí caben **tres** —antes
de cenar, después y al amanecer—, que es lo que se estaba comprando. Los mercados matinales de
Takayama se mudaron entonces al **día 6**, antes del autobús a Shirakawa-gō, donde siguen teniendo
su franja de amanecer.

**La trampa que costó encontrarla**, y la razón de más para dormir en Hirayu: el último autobús de
Kamikōchi a Hirayu sale a las **17:30** y llega a las 17:55; el último de Hirayu a Takayama sale
**también a las 17:30**. Quien intente encadenarlos se queda tirado abajo. Durmiendo en Hirayu el
problema no existe — pero si alguien vuelve a plantear seguir hasta Takayama esa noche, que sepa que
hay que salir del valle sobre las **16:00**.

**Lo que se perdió y no se disimula:** el amanecer en el estanque Taishō. La inversión
`dormir-en-kamikochi` se conserva **aunque la decisión ya no exista**, porque explica el porqué a
quien lea la guía a tiempo — esa es la regla, no borrar las renuncias.

**El Fuji del 23 no se movió.** Está contratado con [Turismo Victoria](https://turismovictoria.com):
diez horas guiadas en español, recogida en **Shin-Fuji a las 8:30**, y el cuarto viajero ya no está.
La trampa al comprar el tren: **en Shin-Fuji solo para el Kodama**, ni Nozomi ni Hikari.

**Cómo se hizo el renumerado, por si hay que repetirlo.** Los 21 días cambiaron de orden y de slug a
la vez, con colisiones entre nombres (`dia-5-kamakura` → `dia-8-kamakura` mientras existía
`dia-8-bajada`). La forma que funcionó: cargar **todos** los ficheros en memoria, aplicar el mapa,
borrar el directorio y reescribir — y en la misma pasada sustituir las anclas `#dia-…` en todo
`content/`. Cuidado con el paso siguiente: remapear «día N» en la prosa **pisa los ficheros que ya
hayas reescrito a mano** con los números nuevos. Hazlo antes de escribir a mano, no después.

---

## 9 bis. Nara fuera, un domingo de Tokio dentro (ago 2026, después de la reforma)

El día de **Nara se ha eliminado** y el día que liberaba se ha gastado en **un domingo entero en el
centro de Tokio** (día 10, 15 de noviembre). Fue decisión del grupo, sin matices: no querían ir.

El cambio salió redondo por una razón aritmética que conviene entender antes de volver a tocarlo:
**quitar un día en Kansai y meter uno en Tokio deja intactas todas las fechas del 20 de noviembre en
adelante**. Hiroshima sigue clavada al viernes 20 y Miyajima al sábado 21, con sus mismos números de
día. Solo se movieron los días 10 a 14, y los días 15 a 21 no se tocaron. Si alguna vez hay que
deshacerlo, se deshace igual de barato.

Tres cosas que decidió esta reforma y que no hay que revertir por descuido:

- **El Shinkansen de bajada va ahora en lunes**, no en domingo. Era una fricción que el propio mapa
  del viaje listaba como aviso, y ha desaparecido.
- **Kioto pasa a cuatro noches de verdad** (16-19). El mapa ya decía «cuatro noches» y eran cinco:
  ahora la frase es cierta.
- **La ficha de Nara y el bar de Nara se borraron**, y todos los `[Nara](#nara)` del resto de la guía
  se convirtieron en texto plano. Nara se sigue mencionando mucho —es historia del país, no una
  parada— pero ya no enlaza a ninguna parte. La renuncia queda contada en el mapa del viaje, que es
  donde van las renuncias.

**Ya no queda día comodín.** El de Kansai se ha gastado. De aquí en adelante, meter algo en el
itinerario obliga a quitar algo.

**Y de paso salieron tres errores de día de la semana que venían de la reforma de agosto** y que no
tenían nada que ver con Nara. Los tres están arreglados, pero valen como aviso de lo que hay que
mirar cuando se renumeran días: **el `eyebrow` dice la fecha, pero la prosa dice el día de la semana,
y la prosa no se renumera sola.**

- El día 6 (mié 11 nov) tenía una ventana titulada «Una carta de hoy, que es domingo 15» con el
  *shichi-go-san* dentro. Se ha borrado: el *shichi-go-san* vive ahora en el día 10, que sí es el 15.
- El día 20 (mié 25 nov) se llamaba «El lunes que cierra todo» y **todo el día colgaba de los cierres
  de los lunes** — los jardines del Palacio, el Museo Nezu, teamLab. En miércoles no cierra nada, así
  que el día se ha rearmado sobre otra premisa: es el último completo y cae dentro del pico del
  momiji.
- Ese mismo día 20 avisaba de que «llegáis dos semanas antes del momiji de Tokio» cuando el 25 de
  noviembre está **dentro** del pico (20 nov – 5 dic) que la propia ficha del momiji declara. Era una
  contradicción directa con el `rationale` de `trip.yml`.

**Si vuelves a renumerar días, la comprobación barata** es cruzar cada `eyebrow` con lo que dice el
cuerpo: `grep -n "lunes\|martes\|domingo\|víspera\|mañana es"` sobre `dias/` y mirarlo uno a uno.
Los tests no cazan nada de esto, porque son datos válidos que dicen mentiras.

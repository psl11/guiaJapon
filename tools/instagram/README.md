# Pipeline de Instagram → sitios de comida

Saca los locales que hay guardados en Instagram y los deja en una base de datos que
después se vuelca a `content/trips/japon/comidas/`.

**Nada de esto entra en el repo salvo el código.** `data/` está en `.gitignore`: ahí viven
la sesión del navegador y los datos personales.

## Tres vías de entrada

Las dos primeras acaban en el mismo `data/media.json` (los guardados). La tercera es la
de un chat y vive aparte, en `data/dm-*.json`: sus datos llevan fecha de envío y remitente,
que los guardados no tienen.

### A · Navegador conducido (`npm run collect`) — necesita contraseña

### B · Consola del navegador (`src/console-dump.js`) — NO necesita contraseña

Sirve cuando no te acuerdas de la contraseña pero **algún navegador ya tiene la sesión
abierta** — el del Mac, o Safari del iPhone conectado por cable e inspeccionado desde
Safari del Mac (menú *Desarrollo* → tu iPhone). Importante: **la app nativa de Instagram
no se puede inspeccionar**, no es un webview; tiene que ser `instagram.com` en Safari.

1. Abre `instagram.com` en ese navegador y comprueba que te ve como tú.
2. Abre la consola (Chrome `Cmd+Opt+J`, Safari `Cmd+Opt+C`).
3. Pega entero `src/console-dump.js` y Enter. Chrome pide escribir `allow pasting`
   la primera vez.
4. Descarga `ig-guardados.json`. Desde el iPhone cae en Archivos → AirDrop al Mac.
5. `npm run import -- ~/Downloads/ig-guardados.json`

El script pregunta a la API interna de Instagram por tus colecciones y las pagina con la
sesión que ya tiene el navegador. **No lee el HTML a propósito**: la rejilla solo tiene
miniaturas, mientras que la respuesta de la API trae caption, hashtags, ubicación con
coordenadas y las URL del vídeo.

### C · Los elementos compartidos de un chat (`npm run collect:dm`) — la vía que se usó

Cuando el intento de compartir la colección de guardados acabó con los reels auto-enviados
uno a uno a la conversación privada, la fuente dejó de ser la rejilla de guardados y pasó a
ser el propio chat. **No es la vía A con otra URL**, y por dos razones que obligan a un
script aparte:

1. **En un chat la fecha que importa no es la del post.** Un reel de hace tres años
   compartido ayer tiene `taken_at` de 2023 y no dice nada. La fecha útil —cuándo llegó al
   chat— vive solo en el envoltorio del mensaje (`timestamp`, en microsegundos), que la vía A
   tira. Sobre ese campo se corta por ventana (`--dias`).
2. **La mitad de lo compartido lo mandaste tú.** El envoltorio trae también el remitente, así
   que se puede filtrar (`--de alba`).

Y una trampa propia: Instagram mete posts en un chat de dos formas muy desiguales.
`media_share` y `clip` traen el objeto completo —caption, hashtags, ubicación—, pero el
formato nuevo `xma_*` trae una **tarjeta de preview sin caption**, que es justo de donde sale
el nombre del sitio. Por eso el script tiene **segunda fase**: los que llegan pelados se
rehidratan visitando su propia página en el mismo navegador ya logueado, y ahí sí responde el
objeto entero. Lo que ni así se rescata **no se descarta**: va a la cola de revisión con la
pista de la tarjeta, porque *«no sabemos qué es»* no es lo mismo que *«no es de Japón»* y
confundirlos es la forma silenciosa de perder sitios.

```bash
npm run collect:dm                  # abre el navegador; abres el chat; sube solo por el historial
npm run parse:dm
npm run identify:dm -- --dias 15 --de alba
npm run review:dm                   # hoja markdown de lo que quedó sin resolver
```

`collect:dm` acepta `--dias 15 --margen 20`: baja **por debajo** de la ventana a propósito.
La regla de parada alternativa —«cuando cinco seguidos no sean de Japón, corta»— solo se
puede evaluar con posts por debajo del corte ya en la mano; bajar justo hasta la fecha deja
al filtro sin nada que mirar. `identify:dm` imprime la cronología día a día con las dos
propuestas de corte (la de fecha y la de la racha) para decidir con los datos delante.

Cada ficha sale con `fuente: "alba"`, que es un campo real de `ComidaSchema` y pinta un chip
en la tarjeta. No confundirlo con `badge`, que es procedencia verificada de un sello.

## Cómo funciona el acceso de la vía A

No hay extracción de cookies ni credenciales por ningún lado. El script abre un Chromium
con perfil persistente, **tú te logueas a mano** en esa ventana (2FA incluido) y la sesión
queda guardada en `data/chrome-profile/`. A partir de ahí el script conduce un navegador
que ya está autenticado — exactamente lo mismo que harías tú bajando por la rejilla, pero
escuchando lo que Instagram responde.

Va a ritmo humano (una pantalla por segundo) a propósito: es tu propia cuenta y no interesa
que Instagram la marque.

## Los cuatro pasos

```bash
cd tools/instagram

npm run collect     # 1A · abre el navegador, te logueas, vas a una colección
npm run import -- ~/Downloads/ig-guardados.json   # 1B · o entra por el volcado de consola
npm run parse       # 2 · aplana el JSON crudo → data/posts.json
npm run identify    # 3 · saca el nombre SOLO del texto y da la estadística
npm run review      # 4 · hoja markdown de lo que quedó sin identificar
```

`collect` es **acumulativo**: lánzalo una vez por colección y la base va creciendo. Si
tienes los sitios de Japón repartidos, no pasa nada.

`review:dudosos` saca la hoja de los identificados con confianza media o baja, para
confirmarlos de un vistazo.

## La cascada de identificación (paso 3)

Solo texto. Sin coste, sin descargar vídeo. Cada post se queda con el primer método que
acierta y **guarda cuál fue**, para poder auditar de dónde salió cada nombre:

| # | señal | confianza |
|---|---|---|
| 1 | ubicación etiquetada en el post (trae nombre real y coordenadas) | alta |
| 2 | nombre entre comillas japonesas `「」` `『』` | alta |
| 3 | línea de chincheta `📍 Nombre` — la convención de los reels de comida | alta |
| 4 | `Nombre:` / `Sitio:` / `店名:` al principio de línea | alta |
| 5 | una única cuenta mencionada distinta del autor (suele ser la del local) | media |
| 6 | primera línea corta del caption | baja |

Si una ubicación etiquetada es un barrio o una ciudad (`Shibuya`, `Tokyo`) **no cuenta como
nombre**: es zona, no local, y el post sigue bajando por la cascada.

## El filtro de Japón

Las coordenadas mandan: si el post trae `lat`/`lng` fuera del recuadro de Japón, se
descarta sin más. Sin coordenadas se acumulan señales — topónimo en la ubicación, hashtag,
kana en el texto. Todo queda en `data/descartados.json` por si el filtro se pasa de listo.

## Qué viene después

Lo que no caiga por texto son candidatos a OCR de frames (`ffmpeg` + visión). Esa fase
**solo tiene sentido si la cola es grande**: por eso el paso 3 se ejecuta primero y da el
número antes de gastar un euro.

Cada ficha lleva ya `fuente: "alba"` para poder separarla de las que meta Pablo.

**Los vídeos no hay que rescatarlos de las DevTools:** la respuesta de la API ya trae
`video_versions[].url`, que son URL firmadas del CDN y **descargan sin sesión** — con
`curl` basta. El único cuidado es que **caducan en unas horas**, así que si acabamos
haciendo OCR hay que bajar los vídeos poco después del volcado, no días más tarde.

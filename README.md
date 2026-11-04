# Japón · guía de viaje

Guía de viaje a Japón para un grupo de cuatro, **del 6 al 26 de noviembre de 2026**. Sitio estático,
sin backend.

**→ https://psl11.github.io/guiaJapon/**

No es un listado de sitios. Cada día lleva sus bloques por franja horaria con la **ventana óptima**
—por qué *entonces* y no a otra hora—, y cada lugar tiene una ficha que explica qué se está mirando.
La historia del país va al final, en seis actos que se leen del tirón.

## El viaje

Dos bucles en tres semanas. El primero: **Tokio → los Alpes (Matsumoto, Kamikōchi) → Hida
(Takayama, Shirakawa-gō) → Kanazawa → vuelta a Tokio** (Yamanote y Kamakura). El segundo: **Kioto →
Osaka → Hiroshima y Miyajima → Tokio**, con el Fuji, Nikkō y las compras al final.

Tres de los cuatro hacen los 21 días; el cuarto vuela de vuelta desde Narita el sábado 14 de
noviembre, y por eso la ruta sube primero a la montaña y vuelve a Tokio antes de la despedida. La
guía cuenta el viaje entero igualmente, y también los días que el cuarto pasa solo en Tokio antes de
que lleguen los demás.

El giro que lo hace distinto está en el medio: **Kamikōchi**, un valle sin coches que **cierra el 15
de noviembre**. Se recorre el lunes 9 y se duerme en Hirayu Onsen, a la salida del valle.

## Cómo se usa en el viaje

Se abre en el navegador del móvil. En iPhone conviene **añadirla a la pantalla de inicio**
(«Compartir → Añadir a pantalla de inicio»), que la abre como una app.

Es una PWA y guarda en caché lo que ya se ha visto, pero **el funcionamiento sin conexión no está
garantizado**: contad con tener datos. Si tras un cambio no aparece lo nuevo, cerrad y volved a abrir
la app.

## Desarrollo

```bash
npm install
npm run dev          # → http://localhost:3000/guiaJapon/  (ojo al subpath)
npx vitest run tests # la puerta real de validación del contenido
npx nuxi generate    # build estático en .output/public
```

El contenido son ficheros YAML en `content/trips/japon/`, validados con zod desde
`shared/schemas.ts`. Para escribir o corregir contenido **no hace falta tocar código**.

**Antes de aportar, lee [CLAUDE.md](CLAUDE.md)**: recoge las convenciones editoriales y las trampas
de la plataforma que ya nos han costado tiempo —entre ellas, que los tests validan los datos pero no
comprueban que la página los pinte.

## Créditos

Textos originales. Datos contrastados con *The Rough Guide to Tokyo* y notas propias de viajes
anteriores. Las fotos son de Pablo Sánchez o de Wikimedia Commons, cada una con su autor y su
licencia indicados bajo la imagen.

_Última revisión del README: 2 de noviembre de 2026._

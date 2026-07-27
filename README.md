# Japón · guía de viaje

Guía de viaje a Japón para un grupo de cuatro, **del 6 al 26 de noviembre de 2026**. Sitio estático,
sin backend, que **funciona sin conexión**.

**→ https://psl11.github.io/guiaJapon/**

No es un listado de sitios. Cada día lleva sus bloques por franja horaria con la **ventana óptima**
—por qué *entonces* y no a otra hora—, y cada lugar tiene una ficha que explica qué se está mirando.
La historia del país va al final, en seis actos que se leen del tirón.

## El viaje

Un bucle de tres semanas: **Tokio → Kamakura → los Alpes → Hida → Kanazawa → Kioto → Osaka →
Hiroshima → vuelta a Tokio**. Tres de los cuatro hacen los 21 días; el cuarto vuelve el 13 de
noviembre, y la guía lo cuenta entero igualmente.

El giro que lo hace distinto está en el medio: **Kamikōchi**, un valle sin coches que **cierra el 15
de noviembre**. Se duerme allí el 12, tres días antes de que corten la carretera.

## Cómo se usa en el viaje

Es una **PWA**: se abre una vez con wifi y guarda todo —textos, fotos y fuentes, unos 13 MB— para
funcionar sin datos.

En iPhone o iPad, **añádela a la pantalla de inicio** («Compartir → Añadir a pantalla de inicio»). No
es un capricho: Safari borra la caché de un sitio web normal tras siete días sin usarlo, pero **no la
de una app añadida a la pantalla de inicio**.

## Desarrollo

```bash
npm install
npm run dev          # → http://localhost:3000/guiaJapon/  (ojo al subpath)
npx vitest run tests # 23 tests · la puerta real de validación del contenido
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

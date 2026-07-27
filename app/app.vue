<script setup lang="ts">
// Favicons bajo el subpath (BUILD-01/03): app.head.link en nuxt.config emite los href
// VERBATIM (Nuxt NO les antepone app.baseURL), así que `/favicon.svg` resolvería a la raíz
// del dominio → 404 bajo /guiaJapon/. Aquí construimos el href con el baseURL en runtime
// (useRuntimeConfig().app.baseURL == '/guiaJapon/') para que apunte a /guiaJapon/favicon.svg,
// donde public/ sirve las copias (A4 / D-02). Concatenación normalizando la barra (sin
// dependencias: joinURL de ufo no está auto-importado y traerlo arriesga el prerender).
const { app } = useRuntimeConfig()
const base = app.baseURL.endsWith('/') ? app.baseURL : `${app.baseURL}/`

useHead({
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` },
    // Fallback PNG para navegadores que ignoran el favicon SVG (p. ej. Safari).
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${base}favicon-32x32.png` },
    // iOS usa el apple-touch-icon (PNG, no el manifest) para el icono de la pantalla de inicio.
    { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` },
    // El manifest en el HTML SSR (el módulo PWA no lo inyecta en SSG): sin él, Chrome/Android no
    // ofrece «Instalar». href con baseURL a mano (mismo motivo que los favicons).
    { rel: 'manifest', href: `${base}manifest.webmanifest` },
  ],
  meta: [
    // iOS: instala como app a pantalla completa con su barra de estado translúcida.
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    // 'default' (no 'black-translucent'): barra de estado normal que NO se solapa con la cabecera
    // fija de la guía (no está pensada para pantalla completa edge-to-edge).
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Japón' },
  ],
})

// Cabecera, INDEPENDIENTE del tema. Los DOS <meta name="theme-color" media="(prefers-color-scheme:
// …)"> fijan el color del chrome del navegador según el esquema del SO (se nota en móvil). NO los
// inyecta @nuxtjs/color-mode (su única inyección en <head> es el script anti-FOUC): van a mano, y
// sus valores deben seguir a los --bg de tokens.css.
useHead({
  htmlAttrs: { lang: 'es' },
  title: 'Japón · 6—13 noviembre 2026',
  meta: [
    { name: 'theme-color', content: '#14161a', media: '(prefers-color-scheme: dark)' },
    { name: 'theme-color', content: '#f2efe7', media: '(prefers-color-scheme: light)' },
  ],
})
</script>

<template>
  <!--
    app.vue = raíz de la app: SOLO <NuxtPage/> (sin <NuxtLayout>). El chrome (Topbar/
    NavPills/BackButton/footer) NO vive en un layout: lo posee TripView (convención A3 del
    Plan 02/04). Las páginas (index.vue, trips/[slug].vue) son one-liners <TripView :slug>,
    así que NO hay app/layouts/ y NuxtPage monta directamente el árbol de la página.
  -->
  <NuxtPage />
</template>

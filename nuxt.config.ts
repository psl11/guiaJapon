// nuxt.config.ts — Fase 1 (scaffold + CSS verbatim + módulos del stack + subpath de producción)
// Plan 02: modules / app.baseURL / css / colorMode / typescript / eslint / fonts.
// Plan 03 (AÑADIDO): nitro.preset github_pages + prerender (failOnError), favicons bajo el subpath.
// compatibilityVersion 4 es el DEFAULT en Nuxt 4 — NO hace falta future.compatibilityVersion.
export default defineNuxtConfig({
  modules: ['@nuxt/content', '@nuxtjs/color-mode', '@nuxt/fonts', '@nuxt/eslint', '@vite-pwa/nuxt'],

  // PWA — instalable + OFFLINE COMPLETO. En Japón el móvil casi siempre tendrá datos, pero el
  // offline se gana el sitio igual: Kamikōchi es un valle de montaña de cobertura irregular, y una
  // guía que abre instantánea en el metro se consulta mientras que una que carga, no. Precachea TODO
  // el output: app shell (js/css/html), las fuentes woff2 self-hosted, el contenido (_payload.json +
  // sql dumps) y las fotos webp. Subpath de GitHub Pages: scope/start_url/id fijados a /guiaJapon/
  // (los `src` de icono van RELATIVOS → resuelven contra la URL del manifest, que ya vive bajo
  // /guiaJapon/). registerType 'autoUpdate': al desplegar contenido nuevo el service worker se
  // actualiza solo, sin prompt. background/theme = noche de laca (splash y barra de estado).
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/guiaJapon/',
      name: 'Japón · Guía de viaje',
      short_name: 'Japón',
      description: 'Guía de viaje a Japón (6–26 noviembre 2026): Tokio, los Alpes, Hida, Kioto y Hiroshima. Funciona sin conexión.',
      lang: 'es',
      dir: 'ltr',
      start_url: '/guiaJapon/',
      scope: '/guiaJapon/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#14161a',
      theme_color: '#14161a',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Todo lo que hace falta para el offline total. Ninguna imagen supera ~340 KB, pero subimos el
      // tope por si acaso; el precache total ronda los ~9 MB (una descarga única con wifi).
      globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2,txt,json,ico}'],
      maximumFileSizeToCacheInBytes: 4194304,
      cleanupOutdatedCaches: true,
    },
    // En desarrollo NO registrar el SW (evita que el caché moleste al iterar).
    devOptions: { enabled: false },
  },

  // Subpath de producción: el sitio vive en psl11.github.io/guiaJapon/.
  // baseURL del Plan 02. Los favicons (Plan 03) se declaran en app/app.vue con useHead +
  // useRuntimeConfig().app.baseURL: Nuxt NO antepone baseURL a los href de app.head.link,
  // así que un `/favicon.svg` estático daría 404 bajo el subpath. public/ sirve las copias
  // las copias en /guiaJapon/favicon.svg.
  app: {
    baseURL: '/guiaJapon/',
  },

  // CSS editorial VERBATIM, cargado UNA sola vez. ORDEN crítico: base consume las variables de tokens.
  // fonts.css PRIMERO: declara las @font-face vendorizadas (woff2 EXACTOS del golden) antes de que
  // base.css las use en `font-family` (F8 / 08-06 — paridad-pixel del wrap, Blocker B).
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/tokens.css',
    '~/assets/css/base.css',
  ],

  // Tema: registrar el módulo en Fase 1 (el ThemeToggle/uso es Fase 3).
  // Emite <html data-theme="dark">, que es el selector que espera base.css.
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    storageKey: 'japon-theme',
    classSuffix: '',
  },

  // Salida 100% estática para GitHub Pages (BUILD-01/03). SSR-en-build ON (NUNCA SPA shell):
  // el preset github_pages prerenderiza a .output/public con la estructura de Pages
  // (incl. .nojekyll); failOnError convierte un enlace interno roto en fallo de build
  // (parity guard). El routing es history (default) — las anclas #id son fragmentos, no rutas.
  nitro: {
    preset: 'github_pages',
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: true,
    },
  },

  // TypeScript estricto (PLAT-02); typeCheck en comando separado (`pnpm typecheck`).
  typescript: {
    strict: true,
    typeCheck: false,
  },

  // Formateo vía @nuxt/eslint (stylistic) — una sola herramienta, sin mezclar con Prettier.
  // typescript: true → incluye el parser/reglas de typescript-eslint para los .ts FUERA del
  // grafo Vue (shared/, tests/data/, *.config.ts). Por defecto @nuxt/eslint lo deja en false
  // y esos ficheros caerían a espree (que no entiende `: tipo`/`export type`). Fase 2 es la
  // primera con código fuente TS tipado lintado, de ahí que haga falta activarlo ahora.
  eslint: {
    config: {
      stylistic: true,
      typescript: true,
    },
  },

  // FUENTES — VENDORIZADAS, self-host EXACTO del golden (BUILD-02 offline + PARIDAD-PIXEL F8/08-06).
  //
  // GROUND TRUTH (medido en el Playwright Chromium que captura el golden): el index.html vivo carga
  // de Google las instancias VARIABLES de Lora (woff2 normal-latin = 37792 B, italic-latin = 40648 B,
  // v37) y renderiza la prosa a 388px (cadena de prueba) → el golden tiene ESA métrica. El intento
  // previo (provider 'fontsource', estático) servía una Lora DISTINTA y más ESTRECHA (374px) → cada
  // párrafo con italica/upright mezclados (`<em>in situ</em>`) caía a 9 líneas vs 10 del golden
  // (#inicio móvil 2174 vs 2200; toHaveScreenshot falla por DIMENSIÓN, no absorbible por
  // maxDiffPixelRatio). La clasificación previa invirtió el signo (creyó la variable "más ancha de más"
  // y que fontsource == Google; AMBAS premisas eran falsas — los woff2 difieren en bytes Y en ~3.6% de
  // avance). CORRECCIÓN: se vendorizan los woff2 EXACTOS que Google sirve a Chromium (subsets latin +
  // latin-ext, los únicos que el contenido es/it usa) en app/assets/fonts/, declarados en
  // app/assets/css/fonts.css. Vite los empaqueta y los sirve self-hosted bajo /guiaJapon/_nuxt/ → CERO
  // petición a fonts.gstatic.com/googleapis.com en RUNTIME (offline preservado), y byte-idénticos al
  // golden por construcción → el wrap cuadra al píxel.
  //
  // @nuxt/fonts queda registrado (otros usos futuros) pero con las 3 familias en `provider: 'none'`:
  // NO debe resolver ni inyectar @font-face/caras-fallback propias para Lora/Cormorant/JetBrains (eso
  // reintroduciría la fuente equivocada y las caras métricas "X Fallback:" que el original no tiene).
  // Las @font-face vivas son SOLO las de fonts.css.
  fonts: {
    families: [
      { name: 'Cormorant Garamond', provider: 'none' },
      { name: 'Lora', provider: 'none' },
      { name: 'JetBrains Mono', provider: 'none' },
    ],
  },

  // Enlaces EXTERNOS del markdown (Goodreads, Filmaffinity…) → PESTAÑA NUEVA, para no sacar al
  // lector de la guía y obligarle a volver atrás. MDC ya aplica rehype-external-links (de ahí el
  // rel="nofollow"); aquí solo le pasamos las opciones target + rel. El parser hace `defu` profundo
  // con sus defaults, así que la instancia del plugin se conserva. Los enlaces internos (#ancla) no
  // son "external" para el plugin → se quedan en la misma pestaña (índice, saltos internos).
  content: {
    build: {
      markdown: {
        rehypePlugins: {
          'rehype-external-links': {
            options: {
              target: '_blank',
              rel: ['nofollow', 'noopener', 'noreferrer'],
            },
          },
        },
      },
    },
  },
})

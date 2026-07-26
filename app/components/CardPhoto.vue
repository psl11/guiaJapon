<script setup lang="ts">
// CardPhoto — foto principal (banner) de una tarjeta: plato/bebida (PlatoCard) o ficha de
// monumento/emplazamiento (FichaCard). La imagen es SIEMPRE un WebP local en public/img/…
// (descargado de Wikimedia Commons y optimizado con sharp); nunca una URL remota.
//
// Rendimiento (la preocupación del scroll infinito): `loading="lazy"` → el navegador NO descarga
// la foto hasta que se acerca al viewport, así la carga inicial no cambia por mucho que crezca la
// página; el `aspect-ratio` fijo (en CSS) reserva el hueco antes de que cargue → cero salto de
// maquetación (CLS) mientras se hace scroll. `decoding="async"` mantiene el hilo principal libre.
//
// baseURL: un <img src> plano NO recibe el prefijo de baseURL de Nuxt, así que lo anteponemos a mano
// (src es relativo, p. ej. 'img/platos/pho.webp') para que resuelva bajo /guiaJapon/ en GitHub Pages.
const props = defineProps<{
  image: { src: string, alt: string, credit: string, creditUrl?: string }
}>()

const base = useRuntimeConfig().app.baseURL
const src = computed(() => base + props.image.src)
</script>

<template>
  <figure class="card-photo">
    <img
      :src="src"
      :alt="image.alt"
      loading="lazy"
      decoding="async"
    >
    <figcaption class="card-photo-credit">
      <a
        v-if="image.creditUrl"
        :href="image.creditUrl"
        target="_blank"
        rel="noopener nofollow"
      >{{ image.credit }}</a>
      <span v-else>{{ image.credit }}</span>
    </figcaption>
  </figure>
</template>

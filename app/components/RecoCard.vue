<script setup lang="ts">
// RecoCard — el directorio práctico de la Parte I: una tarjeta por hotel / reserva / sitio.
// Pensada para MIRAR de un vistazo: título + zona + chip de estado (reservado/pendiente) + una
// línea de meta (precio/noches/cuándo) + el porqué + un enlace de reserva o mapa. Se agrupa por
// `kind` en TripView. Sin `<MDC unwrap>` (el cuerpo va con <MDC> sin unwrap → hidrata limpio).
import type { Reco } from '~~/shared/schemas'

defineProps<{ reco: Reco }>()

const STATUS_LABEL: Record<string, string> = {
  reservado: 'Reservado',
  pendiente: 'Pendiente',
  opcional: 'Opcional',
}
</script>

<template>
  <article
    :id="reco.slug"
    class="reco"
    :data-status="reco.status"
  >
    <div class="reco-head">
      <div class="reco-headings">
        <h3 class="reco-title">
          {{ reco.title }}
        </h3>
        <div
          v-if="reco.area"
          class="reco-area"
        >
          {{ reco.area }}
        </div>
      </div>
      <span
        v-if="reco.status"
        class="reco-status"
      >{{ STATUS_LABEL[reco.status] }}</span>
    </div>

    <div
      v-if="reco.note"
      class="reco-meta"
    >
      {{ reco.note }}
    </div>

    <div class="reco-body">
      <MDC :value="reco.body" />
    </div>

    <a
      v-if="reco.link"
      class="reco-link"
      :href="reco.link.url"
      target="_blank"
      rel="noopener noreferrer"
    >{{ reco.link.label }} →</a>
  </article>
</template>

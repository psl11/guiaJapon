<script setup lang="ts">
// PlatoCard — una ficha de la GUÍA DE PLATOS Y BEBIDAS (no un local): qué es · historia · dónde se
// prepara mejor · picante · versión vegetariana (obligatoria y explícita) · dónde probarlo (enlaces
// a los locales del directorio). Sin <MDC unwrap>. El chip VEG se colorea por su propio texto.
import type { Plato } from '~~/shared/schemas'

const props = defineProps<{ plato: Plato }>()

const vegClass = computed(() => {
  const v = props.plato.veg.toLowerCase()
  if (/^no\b|no apto|no existe|no hay|no de serie|no en/.test(v)) return 'veg--no'
  if (/^s[íi]\b|existe|f[áa]cil|habitual|apto|excelente/.test(v)) return 'veg--si'
  return 'veg--ok'
})
</script>

<template>
  <article
    :id="plato.slug"
    class="plato"
    :data-kind="plato.kind"
  >
    <CardPhoto
      v-if="plato.image"
      :image="plato.image"
    />

    <div class="plato-head">
      <h3 class="plato-title">
        {{ plato.title }}
      </h3>
      <span
        v-if="plato.picante"
        class="cchip"
      >Picante: {{ plato.picante }}</span>
    </div>

    <div class="plato-section">
      <span class="plato-label">Qué es</span>
      <MDC :value="plato.queEs" />
    </div>

    <div
      v-if="plato.historia"
      class="plato-section"
    >
      <span class="plato-label">Historia</span>
      <MDC :value="plato.historia" />
    </div>

    <div
      v-if="plato.body"
      class="plato-body"
    >
      <MDC :value="plato.body" />
    </div>

    <div
      class="plato-veg"
      :class="vegClass"
    >
      <span class="plato-label">¿Versión vegetariana?</span>
      <MDC :value="plato.veg" />
    </div>

    <div
      v-if="plato.dondeMejor"
      class="plato-donde"
    >
      <span class="plato-donde-label">Dónde mejor</span> {{ plato.dondeMejor }}
    </div>

    <div
      v-if="plato.seenIn?.length"
      class="plato-foot"
    >
      <span class="plato-foot-label">Dónde probarlo</span>
      <a
        v-for="l in plato.seenIn"
        :key="l.ref"
        class="chip"
        :href="l.ref"
      >{{ l.label }}</a>
    </div>
  </article>
</template>

<script setup lang="ts">
// ActoCard — archetipo narrativo (cinabrio). Se lee del tirón: numeral árabe grande, capitular
// en el lead, citas destacadas (blockquotes del markdown → pull-quotes vía CSS) y caja "lo veréis".
// La prosa larga (body, connect) va con <MDC> dentro de su <div>, que es donde el div raíz de MDC
// es HTML válido. El título y el lead son inline y viven en <h2>/<p>: ahí <MDC unwrap="p"> metía
// un <div> dentro del <p> —HTML inválido— y rompía la hidratación, así que usan `inlineMd`
// (app/utils/inline-md.ts, auto-importado), que da el mismo HTML en servidor y cliente.
import type { Acto } from '~~/shared/schemas'

defineProps<{ acto: Acto }>()
</script>

<template>
  <article
    :id="acto.slug"
    class="acto"
  >
    <!-- Cabecera en grid (2 col × 2 filas): en desktop el numeral abarca las dos filas a la
         izquierda; en móvil (ver base.css) numeral+kicker arriba y el título a todo el ancho
         debajo, para que no quede arrinconado en una columna estrecha. -->
    <div class="acto-head">
      <!-- Numeral de TAMAÑO FIJO (mismo en todos los actos = serie coherente), en su propia columna
           del grid. Texto plano, no SVG: así el glyph nunca desborda su caja ni invade la columna del
           título. Se centra vertical contra el bloque kicker+título, robusto con 1, 2 o 3 líneas. -->
      <div
        class="acto-num"
        aria-hidden="true"
      >
        {{ acto.numeral }}
      </div>
      <div class="acto-kicker">
        {{ acto.kicker }}
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <h2 v-html="inlineMd(acto.title)" />
    </div>
    <div class="acto-rule" />

    <!-- eslint-disable-next-line vue/no-v-html -->
    <p
      class="acto-lead"
      v-html="inlineMd(acto.lead)"
    />
    <div class="acto-body">
      <MDC :value="acto.body" />
    </div>

    <div
      v-if="acto.connect"
      class="connect"
    >
      <div class="connect-label">
        {{ acto.connect.label }}
      </div>
      <MDC :value="acto.connect.body" />
    </div>
  </article>
</template>

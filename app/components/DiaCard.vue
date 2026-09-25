<script setup lang="ts">
// DiaCard — archetipo del itinerario (Parte I), modelo "bloques como tarjetas".
// El eje NO es la agenda por horas sino los BLOQUES del día (amanecer/mañana/mediodía/tarde/noche),
// cada uno una tarjeta con su "ventana óptima": el porqué de ese momento (luz/gentío/calor). Esa
// caja dorada es el alma del plan — la hora es referencia, no orden.
//
// Hidratación: NADA de <MDC unwrap="p"> (envuelve el texto en un <div> y desincroniza). El título
// del día va con `inlineMd` (app/utils/inline-md.ts, auto-importado): función pura, mismo HTML en
// servidor y cliente. La prosa (dek, cuerpo, ventana) va con <MDC :value> SIN unwrap dentro de su
// contenedor <div>, donde el div raíz de MDC es HTML válido.
import type { Dia, Hotel } from '~~/shared/schemas'

// `hoteles` llega ya resuelto desde TripView (los de `dia.duerme`, en ese orden).
defineProps<{ dia: Dia, hoteles?: Hotel[] }>()
</script>

<template>
  <article
    :id="dia.slug"
    class="dia"
  >
    <div class="dia-eyebrow">
      {{ dia.eyebrow }}
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <h2
      class="dia-title"
      v-html="inlineMd(dia.title)"
    />
    <div
      v-if="dia.dek"
      class="dia-dek"
    >
      <MDC :value="dia.dek" />
    </div>

    <!--
      TRASLADOS. En la cabecera del día y no dentro del arco, porque un traslado no es un momento
      sino la costura entre dos días: se consulta la víspera. Va en índigo (el color de lo
      consultivo, igual que las alternativas) para no competir con la espina en momiji.
      Todo el texto por `inlineMd`, nunca <MDC>: son celdas inline y un <div> aquí rompe la
      hidratación (ver trampa 3.8 del manual).
    -->
    <div
      v-if="dia.traslados?.length"
      class="dia-moves"
    >
      <div class="dia-moves-label">
        Cómo se llega
      </div>
      <ol class="dia-moves-list">
        <li
          v-for="(t, i) in dia.traslados"
          :key="i"
          class="dia-move"
        >
          <p class="dia-move-route">
            {{ t.desde }} <span
              class="dia-move-arrow"
              aria-hidden="true"
            >→</span> {{ t.hasta }}
          </p>
          <p class="dia-move-meta">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span
              class="dia-move-medio"
              v-html="inlineMd(t.medio)"
            />
            <span class="dia-move-dur">{{ t.duracion }}</span>
            <span
              v-if="t.hora"
              class="dia-move-hora"
            >{{ t.hora }}</span>
          </p>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p
            v-if="t.nota"
            class="dia-move-nota"
            v-html="inlineMd(t.nota)"
          />
        </li>
      </ol>
    </div>

    <!--
      DUERME. Justo debajo de los traslados, porque es su destino: dónde acaba el día. Un enlace a
      la tarjeta del hotel en «Dónde dormir», sin repetir sus datos (regla 4.1: aquí no se explica
      el hotel, se señala). Texto libre en fila flex → mismas defensas que `.dia-move-meta` (3.10).
    -->
    <p
      v-if="hoteles?.length"
      class="dia-sleep"
    >
      <span class="dia-sleep-label">Hoy se duerme en</span>
      <span
        v-for="(h, i) in hoteles"
        :key="h.slug"
        class="dia-sleep-item"
      >
        <span
          v-if="i > 0"
          class="dia-sleep-or"
        >o</span>
        <a :href="`#${h.slug}`">{{ h.title }}</a>
        <span
          v-if="h.status === 'candidato'"
          class="dia-sleep-cand"
        >candidato</span>
      </span>
    </p>

    <div class="dia-blocks">
      <section
        v-for="(b, i) in dia.blocks"
        :key="i"
        class="dia-block"
        :class="{ 'dia-block--rest': b.dim }"
      >
        <header class="dia-bhead">
          <span class="dia-bname">{{ b.block }}</span>
          <span
            v-if="b.time"
            class="dia-btime"
          >{{ b.time }}</span>
        </header>
        <div class="dia-bbody">
          <h3 class="dia-bact">
            {{ b.title }}
          </h3>
          <div class="dia-btext">
            <MDC :value="b.body" />
          </div>
          <div
            v-if="b.window"
            class="dia-window"
          >
            <div class="dia-wlabel">
              {{ b.window.label }}
            </div>
            <div class="dia-wbody">
              <MDC :value="b.window.body" />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!--
      ALTERNATIVAS. Va FUERA del arco de bloques a propósito: no es un momento del día, es una carta
      que se juega o no. El plan principal son los clásicos, escritos para los tres que vienen por
      primera vez; esto es el desvío para el que ya los ha visto cuatro veces. Por eso se pinta en
      índigo (el color de lo consultivo) y no en momiji: no compite con la espina del día.
    -->
    <aside
      v-if="dia.alt"
      class="dia-alt"
    >
      <div class="dia-alt-label">
        {{ dia.alt.label ?? 'Si te desmarcas' }}
      </div>
      <div class="dia-alt-body">
        <MDC :value="dia.alt.body" />
      </div>
    </aside>
  </article>
</template>

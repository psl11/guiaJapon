<script setup lang="ts">
// FichaCard — archetipo de consulta (índigo, modelo B: cabecera índigo + cuerpo en papel).
// Se mira antes de una visita: emblema + epíteto + secciones con título + chips "dónde lo veréis".
// Los emblemas son SVG de CONFIANZA (constantes de este módulo, nunca datos de usuario) → v-html
// seguro. La prosa de las secciones va en Markdown y se renderiza con <MDC>.
import type { Ficha } from '~~/shared/schemas'

const props = defineProps<{ ficha: Ficha, knownAnchors?: Set<string> }>()

// Un chip "dónde lo veréis" enlaza (<a>) si su ancla destino ya existe en la página; si no (una ficha
// de monumento aún por escribir), queda como etiqueta (<span>). knownAnchors llega desde TripView (los
// slugs de todo el contenido + los umbrales). El `ref` del dato lleva '#' (p. ej. "#metropole").
const chipHref = (ref: string) => (props.knownAnchors?.has(ref.replace(/^#/, '')) ? ref : undefined)

// Los `heading` de sección y el epíteto admiten énfasis inline (cursiva para títulos y palabras
// extranjeras). Van con `inlineMd` (app/utils/inline-md.ts, auto-importado), NO con
// <MDC unwrap="p">: MDC envuelve su salida en un <div> y emite un fragmento que desincroniza la
// hidratación. `inlineMd` es una función pura → mismo HTML en servidor y cliente. Cubre el subset
// de los títulos: escape → `code` → **fuerte** → *cursiva*.

// Emblemas: trazo simple, currentColor (heredan el oro de .ficha-emblem). Añadir aquí uno nuevo
// = una clave más; el campo `emblem` de la ficha lo referencia.
const EMBLEMS: Record<string, string> = {
  // Pagoda de cinco pisos (templo budista)
  templo: '<svg viewBox="0 0 40 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="3" x2="20" y2="7"/><path d="M12 12 Q14 12 15 10 Q20 6 25 10 Q26 12 28 12"/><path d="M9 21 Q12 21 13 19 Q20 13 27 19 Q28 21 31 21"/><path d="M6 30 Q10 30 11 28 Q20 21 29 28 Q30 30 34 30"/><path d="M3 39 Q8 39 9 37 Q20 29 31 37 Q32 39 37 39"/><line x1="17" y1="12" x2="17" y2="19"/><line x1="23" y1="12" x2="23" y2="19"/><line x1="15" y1="21" x2="15" y2="28"/><line x1="25" y1="21" x2="25" y2="28"/><line x1="13" y1="30" x2="13" y2="37"/><line x1="27" y1="30" x2="27" y2="37"/></svg>',
  // Torii (santuario shintō)
  torii: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13 Q10 10 22 10 Q34 10 40 13"/><line x1="8" y1="16" x2="36" y2="16"/><line x1="11" y1="23" x2="33" y2="23"/><line x1="14" y1="14" x2="16" y2="39"/><line x1="30" y1="14" x2="28" y2="39"/><line x1="6" y1="39" x2="38" y2="39"/></svg>',
  // Loto (budismo / religión)
  loto: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M22 6 C24 14 24 20 22 26 C20 20 20 14 22 6 Z"/><path d="M22 26 C16 22 12 16 11 9 C18 11 21 18 22 26 Z"/><path d="M22 26 C28 22 32 16 33 9 C26 11 23 18 22 26 Z"/><path d="M8 20 C10 26 15 30 22 31 C29 30 34 26 36 20 C33 30 28 34 22 34 C16 34 11 30 8 20 Z"/></svg>',
  // Incienso / pebetero
  incienso: '<svg viewBox="0 0 40 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8 C13 12 15 13 14 17 M20 6 C19 11 21 12 20 17 M26 8 C25 12 27 13 26 17"/><rect x="9" y="24" width="22" height="12" rx="2"/><line x1="14" y1="24" x2="14" y2="17"/><line x1="20" y1="24" x2="20" y2="16"/><line x1="26" y1="24" x2="26" y2="17"/><line x1="13" y1="30" x2="27" y2="30"/></svg>',
  // Montaña
  montana: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 34 L14 14 L20 24 L27 8 L40 34 Z"/><line x1="2" y1="34" x2="42" y2="34"/></svg>',
  // Cuenco con vapor (gastronomía)
  cuenco: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22 h32 a2 2 0 0 1 2 2 v1 a16 16 0 0 1 -36 0 v-1 a2 2 0 0 1 2 -2 Z"/><path d="M17 12 C16 15 18 16 17 19 M27 12 C26 15 28 16 27 19"/><line x1="4" y1="40" x2="40" y2="40"/></svg>',
  // Libro abierto (palabras, cine, glosario)
  libro: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9 C18 6 12 5 7 6 v24 c5 -1 11 0 15 3 4 -3 10 -4 15 -3 V6 c-5 -1 -11 0 -15 3 Z"/><line x1="22" y1="9" x2="22" y2="33"/></svg>',
  // Machiya: casa de comerciantes, alero hondo y celosía
  casa: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 Q9 19 11 16 L18 13 h8 l7 3 Q35 19 39 19"/><path d="M10 19 V37 M34 19 V37"/><line x1="10" y1="37" x2="34" y2="37"/><line x1="14" y1="23" x2="14" y2="37"/><line x1="18" y1="23" x2="18" y2="37"/><line x1="22" y1="23" x2="22" y2="37"/><line x1="10" y1="23" x2="22" y2="23"/><path d="M26 25 h6 v12 h-6 Z"/><line x1="4" y1="40" x2="40" y2="40"/></svg>',
  // Torre del homenaje japonesa sobre su base de piedra
  castillo: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="5" x2="22" y2="8"/><path d="M9 15 Q13 15 14 13 Q22 8 30 13 Q31 15 35 15"/><path d="M6 25 Q11 25 12 23 Q22 16 32 23 Q33 25 38 25"/><line x1="16" y1="15" x2="16" y2="23"/><line x1="28" y1="15" x2="28" y2="23"/><path d="M8 39 L13 27 h18 l5 12 Z"/><line x1="4" y1="39" x2="40" y2="39"/></svg>',
  // Gasshō-zukuri: el tejado de paja a 60 grados
  gassho: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 5 L37 38 H7 Z"/><line x1="12" y1="27" x2="32" y2="27"/><path d="M18 15 h8 v6 h-8 Z"/><line x1="4" y1="40" x2="40" y2="40"/></svg>',
  // Copa (sake, coctelería, hoteles con historia)
  copa: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 11 h22 a11 10 0 0 1 -11 10 a11 10 0 0 1 -11 -10 Z"/><line x1="22" y1="21" x2="22" y2="35"/><line x1="15" y1="35" x2="29" y2="35"/><line x1="27" y1="7" x2="31" y2="11"/></svg>',
}
</script>

<template>
  <section
    :id="ficha.slug"
    class="ficha"
    :class="{ 'ficha--photo': ficha.image }"
  >
    <CardPhoto
      v-if="ficha.image"
      :image="ficha.image"
    />

    <div class="ficha-band">
      <div class="ficha-head">
        <!-- SVG de confianza (constante del módulo), nunca dato de usuario. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="ficha-emblem"
          aria-hidden="true"
          v-html="EMBLEMS[ficha.emblem] || EMBLEMS.loto"
        />
        <div>
          <div class="ficha-kicker">
            {{ ficha.kicker }}
          </div>
          <h2>{{ ficha.title }}</h2>
        </div>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-if="ficha.epithet"
        class="ficha-epithet"
        v-html="inlineMd(ficha.epithet)"
      />
    </div>

    <div class="ficha-body">
      <div
        v-for="(s, i) in ficha.sections"
        :key="i"
        class="ficha-section"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <h3
          v-if="s.heading"
          v-html="inlineMd(s.heading)"
        />
        <div class="ficha-section-body">
          <MDC :value="s.body" />
        </div>
      </div>

      <div
        v-if="ficha.curiosidades?.length"
        class="curiosidades"
      >
        <div class="curiosidades-label">
          Curiosidades
        </div>
        <ul>
          <li
            v-for="(c, i) in ficha.curiosidades"
            :key="i"
          >
            <MDC :value="c" />
          </li>
        </ul>
      </div>

      <div
        v-if="ficha.seenIn?.length"
        class="seen-in"
      >
        <div class="seen-in-label">
          Dónde lo veréis
        </div>
        <!-- Enlace (<a>) si el destino existe, etiqueta (<span>) si aún no: así no hay anclas muertas
             y los cruces se activan solos conforme se añade contenido (días, recos, otras fichas). -->
        <div class="chips">
          <component
            :is="chipHref(l.ref) ? 'a' : 'span'"
            v-for="l in ficha.seenIn"
            :key="l.ref"
            :href="chipHref(l.ref)"
            class="chip"
          >{{ l.label }}</component>
        </div>
      </div>
    </div>
  </section>
</template>

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

// Los `heading` de sección admiten énfasis inline (cursiva para títulos y palabras extranjeras:
// *El americano impasible*, *chay*). NO usamos <MDC unwrap="p"> aquí: emite un fragmento
// (<!--[-->) que desincroniza la hidratación y hace perder la clase al hermano siguiente
// (.ficha-section-body) — el mismo bug de los pull-quotes. Este render inline produce HTML
// idéntico en SSR y cliente (sin límite de componente), así que la hidratación nunca se
// desalinea. Solo soporta el subset que usan los títulos: escape → `code` → **fuerte** → *cursiva*.
function inlineHeading(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

// Emblemas: trazo simple, currentColor (heredan el oro de .ficha-emblem). Añadir aquí uno nuevo
// = una clave más; el campo `emblem` de la ficha lo referencia.
const EMBLEMS: Record<string, string> = {
  // Prasat / templo-montaña jemer
  templo: '<svg viewBox="0 0 40 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M20 3 L26 15 L23 15 L28 27 L24 27 L30 40 L10 40 L16 27 L12 27 L17 15 L14 15 Z"/><line x1="4" y1="40" x2="36" y2="40"/><circle cx="20" cy="9" r="1.4" fill="currentColor" stroke="none"/></svg>',
  // Loto (budismo / religión)
  loto: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M22 6 C24 14 24 20 22 26 C20 20 20 14 22 6 Z"/><path d="M22 26 C16 22 12 16 11 9 C18 11 21 18 22 26 Z"/><path d="M22 26 C28 22 32 16 33 9 C26 11 23 18 22 26 Z"/><path d="M8 20 C10 26 15 30 22 31 C29 30 34 26 36 20 C33 30 28 34 22 34 C16 34 11 30 8 20 Z"/></svg>',
  // Incienso / altar de los ancestros
  incienso: '<svg viewBox="0 0 40 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8 C13 12 15 13 14 17 M20 6 C19 11 21 12 20 17 M26 8 C25 12 27 13 26 17"/><rect x="9" y="24" width="22" height="12" rx="2"/><line x1="14" y1="24" x2="14" y2="17"/><line x1="20" y1="24" x2="20" y2="16"/><line x1="26" y1="24" x2="26" y2="17"/><line x1="13" y1="30" x2="27" y2="30"/></svg>',
  // Montaña kárstica (Ninh Binh / Ha Giang)
  montana: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 34 L14 14 L20 24 L27 8 L40 34 Z"/><line x1="2" y1="34" x2="42" y2="34"/></svg>',
  // Cuenco con vapor (gastronomía)
  cuenco: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22 h32 a2 2 0 0 1 2 2 v1 a16 16 0 0 1 -36 0 v-1 a2 2 0 0 1 2 -2 Z"/><path d="M17 12 C16 15 18 16 17 19 M27 12 C26 15 28 16 27 19"/><line x1="4" y1="40" x2="40" y2="40"/></svg>',
  // Libro abierto (palabras, cine, glosario)
  libro: '<svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9 C18 6 12 5 7 6 v24 c5 -1 11 0 15 3 4 -3 10 -4 15 -3 V6 c-5 -1 -11 0 -15 3 Z"/><line x1="22" y1="9" x2="22" y2="33"/></svg>',
  // Casa tubo (el casco viejo de Hanoi)
  casa: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 40 V11 l6 -4 6 4 V40"/><line x1="16" y1="18" x2="28" y2="18"/><line x1="16" y1="25" x2="28" y2="25"/><line x1="16" y1="32" x2="28" y2="32"/><rect x="20" y="35" width="4" height="5"/><line x1="6" y1="40" x2="38" y2="40"/></svg>',
  // Copa (el martini del Bamboo Bar / hoteles con historia)
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
      <div
        v-if="ficha.epithet"
        class="ficha-epithet"
      >
        <MDC
          :value="ficha.epithet"
          unwrap="p"
        />
      </div>
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
          v-html="inlineHeading(s.heading)"
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

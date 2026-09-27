<script setup lang="ts">
// BlockPicks — «Qué ver» y «Dónde comer» al pie de un bloque del día. Todo POR REFERENCIA: la ficha,
// el recomendado o el local se pintan en una línea (foto o letra del mapa, nombre, la nota del día)
// con sus enlaces, y el nombre salta a la tarjeta entera. El día no copia nada (regla 4.1).
//
// Enlaces: los externos (Maps, web, reserva, el reel de Alba) abren pestaña nueva; los internos
// (#ficha, #local) se quedan en la guía. Las notas van por `inlineMd`: una línea, sin enlaces.
import type { Dia } from '~~/shared/schemas'
import { TRIP_INDEX, extraKey } from '~/composables/useTripIndex'

type Block = Dia['blocks'][number]
const props = defineProps<{ ver?: Block['ver'], comer?: Block['comer'], letras: Record<string, string> }>()

const idx = inject(TRIP_INDEX)!
const base = useRuntimeConfig().app.baseURL
const maps = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)
const FUENTE = { alba: 'Alba', pablo: 'Pablo' } as const

const verItems = computed(() => (props.ver ?? []).map((v) => {
  if (v.ficha) {
    const f = idx.fichas.value.get(v.ficha)
    return f && { kind: 'ficha' as const, key: v.ficha, title: f.navLabel ?? f.title, href: '#' + f.slug, img: f.image, nota: v.nota }
  }
  if (v.reco) {
    const r = idx.recomendados.value.get(v.reco)
    return r && { kind: 'reco' as const, key: v.reco, title: r.navLabel ?? r.title, href: '#' + r.slug, nota: v.nota,
      fuente: FUENTE[r.fuente], post: r.url, link: r.link, letra: props.letras[extraKey(v)] }
  }
  return { kind: 'sitio' as const, key: v.nombre!, title: v.nombre!, href: maps(v.maps ?? v.nombre!), nota: v.nota,
    letra: props.letras[extraKey(v)] }
}).filter(x => !!x))

const comerItems = computed(() => (props.comer ?? []).map((c) => {
  const x = idx.comidas.value.get(c.comida)
  if (!x) return null
  const mapsUrl = maps([x.title, x.area, x.city].filter(Boolean).join(' '))
  // Si el enlace del local ya es su búsqueda de Maps, no se pinta dos veces.
  const link = x.link && !x.link.url.includes('google.com/maps') ? x.link : undefined
  return { ...x, nota: c.nota, mapsUrl, link, letra: props.letras[`comida:${c.comida}`] }
}).filter(x => !!x))
</script>

<template>
  <div
    v-if="verItems.length || comerItems.length"
    class="picks"
  >
    <div
      v-if="verItems.length"
      class="picks-group"
    >
      <div class="picks-label">
        Qué ver
      </div>
      <ul>
        <li
          v-for="v in verItems"
          :key="v.key"
          class="pick"
        >
          <img
            v-if="v.kind === 'ficha' && v.img"
            class="pick-thumb"
            :src="base + v.img.src"
            :alt="v.img.alt"
            loading="lazy"
            decoding="async"
          >
          <span
            v-else
            class="pick-mark pick-mark--ver"
            :class="{ 'pick-mark--off': !v.letra, 'pick-mark--stop': v.letra?.startsWith('#') }"
          >{{ v.letra?.replace('#', '') ?? '◆' }}</span>
          <div class="pick-main">
            <a
              class="pick-title"
              :href="v.href"
              v-bind="v.kind === 'sitio' ? { target: '_blank', rel: 'noopener' } : {}"
            >{{ v.title }}<span
              v-if="v.kind === 'ficha'"
              class="pick-kind"
            > · la ficha</span><span
              v-else-if="v.kind === 'sitio'"
              aria-hidden="true"
            > ↗</span></a>
            <p
              v-if="v.nota"
              class="pick-nota"
              v-html="inlineMd(v.nota)"
            />
            <p
              v-if="v.kind === 'reco'"
              class="pick-links"
            >
              <span class="pick-fuente">Recomienda {{ v.fuente }}</span>
              <a
                :href="v.post"
                target="_blank"
                rel="noopener"
              >Ver el post ↗</a>
              <a
                v-if="v.link"
                :href="v.link.url"
                target="_blank"
                rel="noopener"
              >{{ v.link.label }} ↗</a>
            </p>
          </div>
        </li>
      </ul>
    </div>

    <div
      v-if="comerItems.length"
      class="picks-group"
    >
      <div class="picks-label">
        Dónde comer cerca
      </div>
      <ul>
        <li
          v-for="c in comerItems"
          :key="c.slug"
          class="pick"
        >
          <span
            class="pick-mark pick-mark--comer"
            :class="{ 'pick-mark--off': !c.letra, 'pick-mark--stop': c.letra?.startsWith('#') }"
          >{{ c.letra?.replace('#', '') ?? '●' }}</span>
          <div class="pick-main">
            <a
              class="pick-title"
              :href="'#' + c.slug"
            >{{ c.title }}</a>
            <span class="pick-sub">
              <span v-html="inlineMd(c.tipo)" /><template v-if="c.precio"> · <span v-html="inlineMd(c.precio)" /></template>
            </span>
            <p
              v-if="c.nota"
              class="pick-nota"
              v-html="inlineMd(c.nota)"
            />
            <p class="pick-links">
              <span
                v-if="c.badge"
                class="pick-badge"
              >{{ c.badge }}</span>
              <span
                v-if="c.fuente"
                class="pick-fuente"
              >Recomienda {{ FUENTE[c.fuente] }}</span>
              <a
                :href="c.mapsUrl"
                target="_blank"
                rel="noopener"
              >Maps ↗</a>
              <a
                v-if="c.link"
                :href="c.link.url"
                target="_blank"
                rel="noopener"
              >{{ c.link.label }} ↗</a>
              <a
                v-if="c.fuenteUrl"
                :href="c.fuenteUrl"
                target="_blank"
                rel="noopener"
              >Ver el post ↗</a>
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.picks {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.8rem;
}
.picks-label {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: 0.35rem;
}
.picks ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
.pick { display: flex; gap: 0.6rem; align-items: flex-start; }
.pick-thumb {
  flex: none;
  width: 2.6rem; height: 2.6rem;
  border-radius: 6px;
  object-fit: cover;
}
.pick-mark {
  flex: none;
  width: 1.45rem; height: 1.45rem; margin-top: 0.05rem;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.66rem; font-weight: 700;
  color: #fff;
}
.pick-mark--ver { background: var(--indigo); border-radius: 4px; }
.pick-mark--comer { background: var(--gold); border-radius: 50%; }
.pick-mark--off { opacity: 0.55; font-size: 0.55rem; }
/* Coincide con una parada del recorrido: el mismo círculo numerado del mapa. */
.pick-mark--stop { background: var(--accent); border-radius: 50%; }
.pick-main { min-width: 0; flex: 1; }
.pick-title { font-weight: 700; color: var(--ink); text-decoration-color: var(--line); overflow-wrap: break-word; }
.pick-kind { font-weight: 400; color: var(--ink-soft); font-size: 0.85em; }
.pick-sub { display: block; font-size: 0.78rem; color: var(--ink-soft); overflow-wrap: break-word; }
.pick-nota { margin: 0.1rem 0 0; font-size: 0.86rem; line-height: 1.4; }
.pick-links {
  margin: 0.2rem 0 0;
  display: flex; flex-wrap: wrap; gap: 0.2rem 0.7rem; align-items: baseline;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.66rem;
}
.pick-links a { color: var(--indigo); }
.pick-badge, .pick-fuente {
  padding: 0.05rem 0.4rem; border-radius: 99px;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}
.pick-fuente { border-color: var(--accent); color: var(--accent); }
</style>

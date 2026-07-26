<script setup lang="ts">
// GuideIndex — el índice flotante de la guía (patrón long-read tipo revista).
//  · En desktop (≥1200px) vive fijo en el margen izquierdo, con scroll-spy: resalta el acto/ficha
//    en el que estás según bajas, y su grupo. Doble función: navegar + «estás aquí».
//  · En estrecho/móvil se pliega en un panel deslizante que abre el botón «Índice» de la cabecera.
// El scroll-spy usa un IntersectionObserver (NO lecturas de layout por frame): resalta el último
// ancla por encima de una línea bajo la cabecera. Todo corre en cliente (onMounted) → sin hidratación.
export interface NavItem { id: string, label: string, numeral?: string, kind: 'acto' | 'ficha' | 'inversion' | 'dia' | 'reco' | 'heading' }
export interface NavGroup { key: string, label: string, anchor: string, items: NavItem[] }

const props = defineProps<{ groups: NavGroup[], open: boolean }>()
const emit = defineEmits<{ close: [] }>()

// Lista de anclas en orden de documento, cada una con su grupo. Incluye los anclas de grupo
// (umbrales de Camboya / Parte I) para que el resaltado del grupo cambie justo al cruzarlos.
const spy = computed(() => {
  const out: { id: string, group: string, isItem: boolean }[] = []
  for (const g of props.groups) {
    if (g.anchor && g.anchor !== 'top') out.push({ id: g.anchor, group: g.key, isItem: false })
    for (const it of g.items) out.push({ id: it.id, group: g.key, isItem: true })
  }
  return out
})

const activeId = ref('') // ítem resaltado
const activeGroup = ref('') // grupo resaltado

// Scroll-spy por IntersectionObserver. Antes: getBoundingClientRect por frame de scroll, que forzaba
// un reflow síncrono del DOM entero (~8.500 nodos) en cada frame → jank que empeoraba al crecer el
// contenido. Ahora el observer marca qué anclas tienen su parte superior por encima de la LÍNEA (root
// recortado a la franja [0, LINE] del viewport); el activo es el ÚLTIMO de esos anclas en orden de
// documento — misma semántica que antes, pero con CERO lecturas de layout por frame y coste O(cambios),
// desacoplado del tamaño del DOM. Se actualiza justo al cruzar cada umbral.
const LINE = 130 // px bajo el borde superior
const visible = new Set<string>() // ids de anclas cuya caja aún solapa la franja [0, LINE]
let io: IntersectionObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | undefined

function pick() {
  let curItem = '', curGroup = ''
  for (const s of spy.value) {
    if (!visible.has(s.id)) continue // no en el DOM o por debajo de la línea → se salta
    curGroup = s.group
    curItem = s.isItem ? s.id : ''
  }
  activeId.value = curItem
  activeGroup.value = curGroup
}

function build() {
  io?.disconnect()
  visible.clear()
  // rootMargin inferior = LINE − innerHeight (negativo) → recorta el root a la franja [0, LINE]: un
  // ancla intersecta mientras su top está por encima de LINE y aún no ha salido por el borde superior.
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target.id)
      else visible.delete(e.target.id)
    }
    pick()
  }, { rootMargin: `0px 0px ${LINE - window.innerHeight}px 0px`, threshold: 0 })
  for (const s of spy.value) {
    const el = document.getElementById(s.id)
    if (el) io.observe(el)
  }
  pick()
}

function onResize() {
  // rootMargin depende de innerHeight → reconstruir el observer (debounce; resize es raro).
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(build, 150)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => {
  build()
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  io?.disconnect()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
  clearTimeout(resizeTimer)
})

// El salto (scroll con offset) y el historial los gestiona plugins/anchor-nav.client.ts vía Vue
// Router, común a todos los enlaces internos. Aquí solo cerramos el panel deslizante (móvil).
</script>

<template>
  <nav
    class="guide-index"
    :class="{ 'is-open': open }"
    aria-label="Índice de la guía"
  >
    <div
      class="gi-backdrop"
      @click="emit('close')"
    />
    <div class="gi-panel">
      <div class="gi-head">
        <span class="gi-head-label">Índice</span>
        <button
          class="gi-close"
          type="button"
          aria-label="Cerrar índice"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="gi-scroll">
        <div
          v-for="g in groups"
          :key="g.key"
          class="gi-group"
          :class="{ 'is-active': g.key === activeGroup }"
        >
          <a
            class="gi-glabel"
            :href="g.anchor === 'top' ? '#' : '#' + g.anchor"
            @click="emit('close')"
          >{{ g.label }}</a>
          <ul class="gi-items">
            <li
              v-for="it in g.items"
              :key="it.id"
              class="gi-item"
              :class="['gi-item--' + it.kind, { 'is-active': it.id === activeId }]"
            >
              <!-- Subtítulo de zona (no enlazable): parte la lista larga en bloques geográficos. -->
              <span
                v-if="it.kind === 'heading'"
                class="gi-subhead"
              >{{ it.label }}</span>
              <a
                v-else
                :href="'#' + it.id"
                :title="it.label"
                @click="emit('close')"
              >
                <span
                  v-if="it.numeral"
                  class="gi-num"
                >{{ it.numeral }}</span>
                <span
                  v-else
                  class="gi-mark"
                  aria-hidden="true"
                >◆</span>
                <span class="gi-label">{{ it.label }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </nav>
</template>

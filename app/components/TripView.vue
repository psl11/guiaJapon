<script setup lang="ts">
// TripView — poseedor de la página. Llama a useTrip(slug) y renderiza en dos tiempos:
//  · El plan (lo práctico, primero): hero del viaje → día a día (DiaCard) → dinero (InversionCard)
//    → reservas y dónde dormir (RecoCard). Es lo que se usa durante el viaje.
//  · El relato (el contexto cultural, después): actos/fichas de Vietnam y Camboya, cada país tras
//    su umbral. Es el porqué: se lee antes de cada tramo.
// "Añadir un viaje = añadir ficheros": las páginas son one-liners <TripView :slug>.
const props = defineProps<{ slug: string }>()

const { trip, actos, fichas, inversiones, dias, recos, comidas, platos, salir } = await useTrip(props.slug)

const vietnamActos = computed(() => actos.value.filter(a => a.part === 'vietnam'))
const vietnamFichas = computed(() => fichas.value.filter(f => f.part === 'vietnam'))
const camboyaActos = computed(() => actos.value.filter(a => a.part === 'camboya'))
const camboyaFichas = computed(() => fichas.value.filter(f => f.part === 'camboya'))
const hayCamboya = computed(() => camboyaActos.value.length + camboyaFichas.value.length > 0)
const hayPlan = computed(() => dias.value.length + inversiones.value.length > 0)

// Recomendaciones (Parte I · prácticos): agrupadas por tipo, en orden fijo de grupo.
// 'comer' ya no está: la comida vive en la sección Gastronomía. Quedan dormir · reservar · moverse.
const RECO_KINDS = [
  { kind: 'dormir', label: 'Dónde dormir' },
  { kind: 'reservar', label: 'Reservas por hacer' },
  { kind: 'moverse', label: 'Cómo moverse' },
  { kind: 'practico', label: 'En destino' },
] as const
const recoGroups = computed(() => RECO_KINDS
  .map(k => ({ ...k, items: recos.value.filter(r => r.kind === k.kind) }))
  .filter(g => g.items.length))

// Gastronomía ─────────────────────────────────────────────────────────────────
// Guía de platos/bebidas (Vietnam) + directorio por país → ciudad → las 7 categorías del cliente.
// Los `soloEl` (iconos no-veg) van a un bloque «solo para ti» aparte por ciudad; el directorio
// principal es veg-friendly (la mesa es para los dos).
const GASTRO_CATS = [
  { key: 'desayuno', label: 'Desayunos' },
  { key: 'cafe', label: 'Cafés de especialidad' },
  { key: 'comida', label: 'Comidas' },
  { key: 'cena', label: 'Cenas' },
  { key: 'street-food', label: 'Street food' },
  { key: 'postre', label: 'Postres' },
  { key: 'cocteleria', label: 'Coctelería y rooftops' },
] as const
const citySlug = (c: string) => 'gastro-' + c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const platosGuia = computed(() => platos.value.filter(p => p.kind === 'plato'))
const bebidasGuia = computed(() => platos.value.filter(p => p.kind === 'bebida'))
const gastroByPart = computed(() => (['vietnam', 'camboya'] as const).map((part) => {
  const inPart = comidas.value.filter(c => c.part === part)
  return {
    part,
    label: part === 'vietnam' ? 'Vietnam' : 'Camboya',
    cities: [...new Set(inPart.map(c => c.city))].map((city) => {
      const inCity = inPart.filter(c => c.city === city)
      return {
        city,
        anchor: citySlug(city),
        cats: GASTRO_CATS.map(cat => ({ ...cat, items: inCity.filter(c => c.category === cat.key && !c.soloEl) })).filter(g => g.items.length),
        soloEl: inCity.filter(c => c.soloEl),
      }
    }),
  }
}).filter(p => p.cities.length))
const hayGastro = computed(() => comidas.value.length + platos.value.length > 0)

// Salir · música y librerías (jazz + librerías) — sección propia, agrupada por kind.
const SALIR_KINDS = [
  { key: 'jazz', label: 'Música en vivo · jazz' },
  { key: 'libreria', label: 'Librerías' },
] as const
const salirGroups = computed(() => SALIR_KINDS
  .map(k => ({ ...k, items: salir.value.filter(s => s.kind === k.key) }))
  .filter(g => g.items.length))
const haySalir = computed(() => salir.value.length > 0)

// Todas las anclas que existen en la página (slugs de todo el contenido + umbrales fijos). Un chip
// "dónde lo veréis" de una ficha se vuelve enlace clicable SOLO si su destino ya existe; si aún no
// (p. ej. una ficha de monumento por escribir), queda como etiqueta. Se auto-activan al crecer la guía.
const knownAnchors = computed(() => new Set<string>([
  ...actos.value.map(a => a.slug),
  ...fichas.value.map(f => f.slug),
  ...inversiones.value.map(i => i.slug),
  ...dias.value.map(d => d.slug),
  ...recos.value.map(r => r.slug),
  ...comidas.value.map(c => c.slug),
  ...platos.value.map(p => p.slug),
  ...salir.value.map(s => s.slug),
  'el-plan', 'gasto', 'reservas', 'gastronomia', 'salir', 'vietnam', 'camboya',
]))

// Índice flotante ─────────────────────────────────────────────────────────────
// Etiqueta corta del índice: navLabel si existe, si no el título sin marcas de markdown.
const stripMd = (s: string) => s
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [txt](url) → txt
  .replace(/[*`]/g, '')
  .trim()

// Convierte una lista de fichas (ya ordenada por `order`) en ítems del índice, insertando un
// subtítulo (kind:'heading', no enlazable) antes de cada nueva `zone`. Así el índice —largo— se lee
// por bloques (Hanói · Ninh Bình · El loop…). El scroll-spy los ignora solo: su id 'zone-…' no
// existe en el DOM (getElementById → null → se salta), así que no altera el resaltado.
function fichaItems(list: { slug: string, navLabel?: string, title: string, zone?: string }[]) {
  const out: { id: string, label: string, kind: 'ficha' | 'heading' }[] = []
  let cur = ''
  for (const f of list) {
    if (f.zone && f.zone !== cur) {
      cur = f.zone
      out.push({ id: 'zone-' + f.slug, label: f.zone, kind: 'heading' })
    }
    out.push({ id: f.slug, label: f.navLabel ?? f.title, kind: 'ficha' })
  }
  return out
}

const nav = computed(() => {
  const groups: { key: string, label: string, anchor: string, items: { id: string, label: string, numeral?: string, kind: 'acto' | 'ficha' | 'inversion' | 'dia' | 'reco' | 'heading' }[] }[] = []
  // El plan primero (lo práctico): el día a día, el gasto y las reservas —cada bloque, un grupo.
  if (dias.value.length) {
    groups.push({
      key: 'plan',
      label: 'El viaje, día a día',
      anchor: 'el-plan',
      items: dias.value.map(d => ({ id: d.slug, label: d.navLabel ?? stripMd(d.title), kind: 'dia' as const })),
    })
  }
  if (inversiones.value.length) {
    groups.push({
      key: 'gasto',
      label: 'Dónde gastar',
      anchor: 'gasto',
      items: inversiones.value.map(i => ({ id: i.slug, label: i.navLabel ?? stripMd(i.title), kind: 'inversion' as const })),
    })
  }
  if (recos.value.length) {
    // Las CUATRO categorías (dormir · reservar · comer · moverse) se colapsan a UN enlace cada una,
    // que salta a su subsección (#dormir/#reservar/#comer/#moverse). El índice de prácticos queda en
    // 4 entradas en vez de 17: es un directorio para hojear por bloques, no ítem a ítem.
    const items = recoGroups.value.map(g => ({ id: g.kind, label: g.label, kind: 'reco' as const }))
    groups.push({ key: 'reservas', label: 'Los prácticos', anchor: 'reservas', items })
  }
  // Gastronomía: índice compacto (platos + una entrada por ciudad), no local a local.
  if (hayGastro.value) {
    const items: { id: string, label: string, kind: 'reco' }[] = []
    if (platos.value.length) items.push({ id: 'gastro-platos', label: 'Platos y bebidas', kind: 'reco' as const })
    for (const pg of gastroByPart.value) for (const cg of pg.cities) items.push({ id: cg.anchor, label: `${cg.city} (${pg.label})`, kind: 'reco' as const })
    groups.push({ key: 'gastronomia', label: 'Gastronomía', anchor: 'gastronomia', items })
  }
  if (haySalir.value) {
    groups.push({ key: 'salir', label: 'Salir · música y librerías', anchor: 'salir', items: salir.value.map(s => ({ id: s.slug, label: s.navLabel ?? s.title, kind: 'reco' as const })) })
  }
  // Después, el relato cultural: Vietnam y Camboya.
  groups.push({
    key: 'vietnam',
    label: 'Vietnam',
    anchor: 'vietnam',
    items: [
      ...vietnamActos.value.map(a => ({ id: a.slug, label: a.navLabel ?? stripMd(a.title), numeral: a.numeral, kind: 'acto' as const })),
      ...fichaItems(vietnamFichas.value),
    ],
  })
  if (hayCamboya.value) {
    groups.push({
      key: 'camboya',
      label: 'Camboya',
      anchor: 'camboya',
      items: [
        ...camboyaActos.value.map(a => ({ id: a.slug, label: a.navLabel ?? stripMd(a.title), numeral: a.numeral, kind: 'acto' as const })),
        ...fichaItems(camboyaFichas.value),
      ],
    })
  }
  return groups
})

const indexOpen = ref(false)
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button
        class="gi-btn"
        type="button"
        :aria-expanded="indexOpen"
        aria-controls="guide-index"
        @click="indexOpen = !indexOpen"
      >
        <span
          class="gi-btn-icon"
          aria-hidden="true"
        >☰</span> Índice
      </button>
      <div class="brand">
        Vietnam <span class="brand-dot">✦</span> Camboya
      </div>
    </div>
    <ThemeToggle />
  </header>

  <GuideIndex
    id="guide-index"
    :groups="nav"
    :open="indexOpen"
    @close="indexOpen = false"
  />

  <main class="wrap">
    <section
      v-if="trip"
      class="hero"
    >
      <div class="eyebrow">
        {{ trip.eyebrow }}
      </div>
      <h1>
        <MDC
          :value="trip.title"
          unwrap="p"
        />
      </h1>
      <p
        v-if="trip.lede"
        class="lede"
      >
        <MDC
          :value="trip.lede"
          unwrap="p"
        />
      </p>
    </section>

    <!-- El plan primero (lo práctico): el día a día → el dinero. -->
    <template v-if="hayPlan">
      <Threshold
        id="el-plan"
        overline="De Hanoi a Angkor · dieciséis días"
        title="El viaje, *día a día*"
        dek="El eje no es la agenda por horas sino los bloques del día —amanecer, mañana, siesta, tarde, noche— y su «ventana óptima»: por qué *entonces* (la luz, el gentío, el calor), no a qué hora."
      />
      <TripMap />
      <section
        v-if="trip?.rationale"
        class="trip-why"
        aria-label="Por qué este itinerario"
      >
        <p class="trip-why-eyebrow">
          Por qué este viaje
        </p>
        <MDC :value="trip.rationale" />
      </section>
      <DiaCard
        v-for="d in dias"
        :key="d.slug"
        :dia="d"
      />

      <template v-if="inversiones.length">
        <Threshold
          id="gasto"
          overline="El dinero del viaje"
          title="Dónde gastar, dónde *no*"
          dek="Aquí no se gasta por gastar. Cada decisión que cuesta dinero llega con su ficha —cuesta, qué compra, la alternativa— y su veredicto. Que algunas salgan «prescindible» es lo que hace que las demás valgan."
        />
        <InversionCard
          v-for="inv in inversiones"
          :key="inv.slug"
          :inversion="inv"
        />
      </template>
    </template>

    <!-- Los prácticos: el directorio de hoteles y reservas (agrupado por tipo). -->
    <template v-if="recos.length">
      <Threshold
        id="reservas"
        overline="Los prácticos"
        title="Reservas y *dónde dormir*"
        dek="El tablero de lo que hay que reservar —con su estado— y dónde dormir en cada tramo. Lo pendiente en oro; lo cerrado, en índigo."
      />
      <div
        v-for="g in recoGroups"
        :id="g.kind"
        :key="g.kind"
        class="reco-group"
      >
        <div class="reco-group-label">
          {{ g.label }}
        </div>
        <RecoCard
          v-for="r in g.items"
          :key="r.slug"
          :reco="r"
        />
      </div>
    </template>

    <!-- Gastronomía: la guía de platos/bebidas + el directorio por país → ciudad → categoría. -->
    <template v-if="hayGastro">
      <Threshold
        id="gastronomia"
        overline="La mesa"
        title="*Gastronomía*"
        dek="Dónde comer y beber bien, con lo local y auténtico por delante. Cada sitio con su estatus vegetariano explícito, su sello si lo tiene (Michelin, Bib Gourmand, Asia's 50 Best…) y su encaje con el itinerario. Y una guía de los platos y bebidas que no hay que perderse."
      />

      <template v-if="platosGuia.length || bebidasGuia.length">
        <div
          id="gastro-platos"
          class="gastro-band"
        >
          Platos imprescindibles · Vietnam
        </div>
        <PlatoCard
          v-for="p in platosGuia"
          :key="p.slug"
          :plato="p"
        />
        <template v-if="bebidasGuia.length">
          <div class="gastro-sub">
            Bebidas
          </div>
          <PlatoCard
            v-for="p in bebidasGuia"
            :key="p.slug"
            :plato="p"
          />
        </template>
      </template>

      <template
        v-for="pg in gastroByPart"
        :key="pg.part"
      >
        <div class="gastro-band">
          {{ pg.label }} · dónde comer
        </div>
        <div
          v-for="cg in pg.cities"
          :id="cg.anchor"
          :key="cg.city"
          class="gastro-city"
        >
          <h3 class="gastro-city-name">
            {{ cg.city }}
          </h3>
          <div
            v-for="cat in cg.cats"
            :key="cat.key"
            class="gastro-cat"
          >
            <div class="gastro-cat-label">
              {{ cat.label }}
            </div>
            <ComidaCard
              v-for="c in cat.items"
              :key="c.slug"
              :comida="c"
            />
          </div>
          <div
            v-if="cg.soloEl.length"
            class="gastro-cat gastro-soloel"
          >
            <div class="gastro-cat-label">
              Los intocables · no aptos para vegetarianos
            </div>
            <ComidaCard
              v-for="c in cg.soloEl"
              :key="c.slug"
              :comida="c"
            />
          </div>
        </div>
      </template>
    </template>

    <!-- Salir · música y librerías (jazz + librerías) — plan de tarde-noche, aparte de la gastronomía. -->
    <template v-if="haySalir">
      <Threshold
        id="salir"
        overline="La noche y la letra impresa"
        title="Salir · *música y librerías*"
        dek="Un club de jazz con historia y las librerías que merecen parada: el plan de tarde-noche con alma, del que no sale en las guías. Poco turístico, muy Hanoi."
      />
      <div
        v-for="g in salirGroups"
        :key="g.key"
        class="gastro-cat"
      >
        <div class="gastro-cat-label">
          {{ g.label }}
        </div>
        <SalirCard
          v-for="s in g.items"
          :key="s.slug"
          :salir="s"
        />
      </div>
    </template>

    <!-- Después, el relato cultural: primero Vietnam, luego Camboya. Cada país tras su umbral. -->
    <Threshold
      id="vietnam"
      overline="Y ahora, el porqué"
      title="Vietnam · *por dentro*"
      dek="Esto no es un listado de sitios: es el trasfondo que convierte una carretera de montaña en mil años de resistencia, y tres días de piedras en tres de significado. Se lee *antes* de cada tramo, y conviven dos tipos de ficha: las que se leen del tirón, como un capítulo, y las que se consultan de un vistazo antes de una visita."
    />
    <ActoCard
      v-for="a in vietnamActos"
      :key="a.slug"
      :acto="a"
    />
    <FichaCard
      v-for="f in vietnamFichas"
      :key="f.slug"
      :ficha="f"
      :known-anchors="knownAnchors"
    />

    <!-- Camboya -->
    <template v-if="hayCamboya">
      <Threshold
        id="camboya"
        overline="El segundo mundo del viaje"
        title="Camboya · *Angkor*"
        dek="De los mil años de resistencia de Vietnam a los seiscientos de un imperio que talló una montaña entera para ser el centro del universo."
      />
      <ActoCard
        v-for="a in camboyaActos"
        :key="a.slug"
        :acto="a"
      />
      <FichaCard
        v-for="f in camboyaFichas"
        :key="f.slug"
        :ficha="f"
        :known-anchors="knownAnchors"
      />
    </template>
  </main>
</template>

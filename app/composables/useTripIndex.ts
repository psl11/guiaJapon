import type { InjectionKey, Ref } from 'vue'
import type { Comida, Dia, Ficha, Recomendado } from '~~/shared/schemas'

// Índice del viaje para los CRUCES: lo que un día referencia por slug (`ver`, `comer`) y, al revés,
// en qué días sale cada local. TripView lo construye una vez y lo provee; DiaCard y ComidaCard lo
// inyectan. Así el día pinta la ficha o el local sin copiarlos, y la tarjeta de Gastronomía sabe
// en qué día cae sin que nadie lo mantenga a mano.
export type TripIndex = {
  fichas: Ref<Map<string, Ficha>>
  comidas: Ref<Map<string, Comida>>
  recomendados: Ref<Map<string, Recomendado>>
  // slug de comida → días (y bloque) donde sale en `comer`
  comidaEnDias: Ref<Map<string, { ref: string, label: string }[]>>
}

export const TRIP_INDEX: InjectionKey<TripIndex> = Symbol('trip-index')

export function buildTripIndex(src: {
  fichas: Ref<Ficha[]>
  comidas: Ref<Comida[]>
  recomendados: Ref<Recomendado[]>
  dias: Ref<Dia[]>
}): TripIndex {
  const bySlug = <T extends { slug: string }>(r: Ref<T[]>) => computed(() => new Map(r.value.map(x => [x.slug, x])))
  const comidaEnDias = computed(() => {
    const m = new Map<string, { ref: string, label: string }[]>()
    for (const d of src.dias.value) {
      const n = d.navLabel?.split('·')[0]?.trim() ?? d.slug
      for (const b of d.blocks) {
        for (const c of b.comer ?? []) {
          const list = m.get(c.comida) ?? []
          if (!list.some(l => l.ref === '#' + d.slug)) list.push({ ref: '#' + d.slug, label: `${n} · ${b.block.toLowerCase()}` })
          m.set(c.comida, list)
        }
      }
    }
    return m
  })
  return {
    fichas: bySlug(src.fichas),
    comidas: bySlug(src.comidas),
    recomendados: bySlug(src.recomendados),
    comidaEnDias,
  }
}

// La clave de un punto del mapa del día. Tiene que coincidir con la de scripts/build-routemap.mjs,
// que es donde se reparten las letras.
export const extraKey = (v: { ficha?: string, reco?: string, nombre?: string }) =>
  v.reco ? `reco:${v.reco}` : `ver:${v.nombre}`

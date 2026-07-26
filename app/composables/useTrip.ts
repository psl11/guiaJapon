import type { Trip, Acto, Ficha, Inversion, Dia, Reco, Comida, Plato, Salir } from '~~/shared/schemas'

// `useTrip(slug)` — punto de entrada ÚNICO y tipado de los datos de un viaje.
//
// Agrega las 3 colecciones de Nuxt Content (trip/acto/ficha) en refs tipadas. "Añadir un viaje =
// añadir ficheros" se cumple aquí: cada colección se filtra por su campo `trip`; el propio viaje
// por `slug`. El ancla estable es `slug`, NUNCA el `id` reservado de Content.
//
// SSG/offline: `queryCollection` resuelve EN PRERENDER contra el dump SQLite de build y se sirve
// como asset estático — sin servidor en runtime. NO usar fetch('/content/…') ni useState.
//
// CONTRATO DE TIPOS: las 3 colecciones son `z.object`, así que Content las tipa bien; aun así se
// castea el retorno a los tipos zod de shared/schemas.ts (la misma fuente que valida en tests) por
// coherencia con el resto de la plataforma.
export async function useTrip(slug: string) {
  const [trip, actos, fichas, inversiones, dias, recos, comidas, platos, salir] = await Promise.all([
    useAsyncData(`trip-${slug}`, () => queryCollection('trip').where('slug', '=', slug).first()),
    useAsyncData(`actos-${slug}`, () => queryCollection('acto').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`fichas-${slug}`, () => queryCollection('ficha').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`inversiones-${slug}`, () => queryCollection('inversion').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`dias-${slug}`, () => queryCollection('dia').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`recos-${slug}`, () => queryCollection('reco').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`comidas-${slug}`, () => queryCollection('comida').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`platos-${slug}`, () => queryCollection('plato').where('trip', '=', slug).order('order', 'ASC').all()),
    useAsyncData(`salir-${slug}`, () => queryCollection('salir').where('trip', '=', slug).order('order', 'ASC').all()),
  ])

  return {
    trip: trip.data as unknown as Ref<Trip | null>,
    actos: actos.data as unknown as Ref<Acto[]>,
    fichas: fichas.data as unknown as Ref<Ficha[]>,
    inversiones: inversiones.data as unknown as Ref<Inversion[]>,
    dias: dias.data as unknown as Ref<Dia[]>,
    recos: recos.data as unknown as Ref<Reco[]>,
    comidas: comidas.data as unknown as Ref<Comida[]>,
    platos: platos.data as unknown as Ref<Plato[]>,
    salir: salir.data as unknown as Ref<Salir[]>,
  }
}

import { defineCollection, defineContentConfig } from '@nuxt/content'
import { TripSchema, ActoSchema, FichaSchema, InversionSchema, DiaSchema, RecoSchema, ComidaSchema, PlatoSchema, SalirSchema } from './shared/schemas'

// Colecciones de la guía. El esquema zod vive en `shared/schemas.ts` y NO inline aquí porque lo
// comparten este config (tipos/columnas) y los tests de tests/data (validación real — Content v3
// no valida los `type:'data'` contra zod en build, #3351).
//
// `type: 'data'` + globs ANIDADOS `trips/*/…` → un fichero = un documento, y multi-viaje es
// trivial (crear content/trips/<otro>/ con los mismos ficheros, cero código).
//
// Las 3 son `z.object` directos (no uniones): Content v3 materializa sus columnas SQL sin el
// workaround del superset plano que hacía falta en Roma.
export default defineContentConfig({
  collections: {
    trip: defineCollection({ type: 'data', source: 'trips/*/trip.yml', schema: TripSchema }),
    acto: defineCollection({ type: 'data', source: 'trips/*/actos/*.yml', schema: ActoSchema }),
    ficha: defineCollection({ type: 'data', source: 'trips/*/fichas/*.yml', schema: FichaSchema }),
    inversion: defineCollection({ type: 'data', source: 'trips/*/inversiones/*.yml', schema: InversionSchema }),
    dia: defineCollection({ type: 'data', source: 'trips/*/dias/*.yml', schema: DiaSchema }),
    reco: defineCollection({ type: 'data', source: 'trips/*/recos/*.yml', schema: RecoSchema }),
    comida: defineCollection({ type: 'data', source: 'trips/*/comidas/*.yml', schema: ComidaSchema }),
    plato: defineCollection({ type: 'data', source: 'trips/*/platos/*.yml', schema: PlatoSchema }),
    salir: defineCollection({ type: 'data', source: 'trips/*/salir/*.yml', schema: SalirSchema }),
  },
})

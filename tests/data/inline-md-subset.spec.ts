import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { inlineMd } from '../../app/utils/inline-md'

/**
 * PUERTA DEL SUBSET INLINE. Los campos de abajo NO se renderizan con `<MDC>` (Markdown completo)
 * sino con `inlineMd`, que solo entiende escape → `código` → **fuerte** → *cursiva*.
 *
 * POR QUÉ ES UNA PUERTA Y NO UN COMENTARIO. La razón de no usar `<MDC>` en estos sitios es de
 * hidratación, no de gusto: MDC envuelve su salida en un `<div>`, y estos campos viven dentro de
 * `<h1>/<h2>/<p>`. Un `<div>` dentro de un `<p>` es HTML inválido — el parser del navegador cierra
 * el `<p>` y saca el div fuera —, el DOM deja de coincidir con el vdom del cliente y la hidratación
 * se desalinea (era el origen de los «Hydration completed but contains mismatches»). Ver
 * app/utils/inline-md.ts para el diagnóstico completo.
 *
 * El precio de ese cambio es que el resto del Markdown ya NO se interpreta en estos campos: un
 * `[enlace](#ancla)` en un lead saldría con sus corchetes a la vista. No es visible al escribirlo
 * —el YAML no se queja—, así que lo vigila este test: si alguien escribe fuera del subset, la
 * puerta de datos falla y explica qué hacer (reescribir sin esa marca, o mover el texto a un campo
 * servido por `<MDC>`, p. ej. el `body` de una sección).
 */

const TRIPS = join(__dirname, '../../content/trips')
const trips = readdirSync(TRIPS, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)

// Los campos servidos por `inlineMd`. Un `pick` por campo, porque no todos son planos:
// `ficha.sections[].heading` es anidado y `trip.yml` es un fichero suelto en la raíz del viaje.
const INLINE_FIELDS: { dir: string, single?: boolean, pick: (doc: Record<string, unknown>) => { field: string, value: unknown }[] }[] = [
  { dir: '', single: true, pick: d => [{ field: 'title', value: d.title }, { field: 'lede', value: d.lede }] }, // hero (TripView)
  { dir: 'actos', pick: d => [{ field: 'title', value: d.title }, { field: 'lead', value: d.lead }] }, // ActoCard
  { dir: 'dias', pick: d => [{ field: 'title', value: d.title }] }, // DiaCard
  { dir: 'inversiones', pick: d => [{ field: 'title', value: d.title }] }, // InversionCard
  { dir: 'platos', pick: d => [{ field: 'dondeMejor', value: d.dondeMejor }, { field: 'picante', value: d.picante }] }, // PlatoCard (v-html con inlineMd)
  { dir: 'comidas', pick: d => [{ field: 'veg', value: d.veg }, { field: 'tipo', value: d.tipo }, { field: 'precio', value: d.precio }, { field: 'colas', value: d.colas }] }, // ComidaCard
  {
    dir: 'fichas', // FichaCard: epíteto + encabezados de sección
    pick: d => [
      { field: 'epithet', value: d.epithet },
      ...(Array.isArray(d.sections) ? d.sections : []).map((s, i) => ({ field: `sections[${i}].heading`, value: (s as { heading?: unknown }).heading })),
    ],
  },
]

// Marcas de Markdown que `inlineMd` NO entiende. El mensaje es para quien escriba el contenido
// dentro de seis meses, no para quien depura el test.
const UNSUPPORTED: { re: RegExp, what: string }[] = [
  { re: /!\[[^\]]*\]\(/, what: 'imagen ![alt](src) — usa el campo `image` de la ficha' },
  { re: /\[[^\]]*\]\([^)]*\)/, what: 'enlace [texto](destino) — muévelo al `body` de una sección (va con <MDC>)' },
  { re: /\[[^\]]*\]\[[^\]]*\]/, what: 'enlace por referencia [texto][ref]' },
  { re: /<[a-zA-Z/]/, what: 'HTML crudo — se escaparía y saldría a la vista' },
  { re: /~~/, what: 'tachado ~~texto~~' },
  { re: /(^|[\s(])_[^_\n]+_([\s.,;:)!?]|$)/, what: 'cursiva con guiones bajos _texto_ — usa *texto*' },
  { re: /\n[ \t]*\n/, what: 'varios párrafos — estos campos son de UNA sola línea de prosa' },
  { re: /^[ \t]*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/m, what: 'sintaxis de bloque (título, lista, cita, código)' },
]

interface Field { rel: string, field: string, value: string }
const fields: Field[] = []

for (const trip of trips) {
  for (const c of INLINE_FIELDS) {
    const dir = join(TRIPS, trip, c.dir)
    if (!existsSync(dir)) continue
    const files = c.single ? ['trip.yml'] : readdirSync(dir).filter(f => f.endsWith('.yml'))
    for (const f of files) {
      const full = join(dir, f)
      if (!existsSync(full)) continue
      const doc = parse(readFileSync(full, 'utf8')) as Record<string, unknown>
      for (const { field, value } of c.pick(doc)) {
        if (typeof value === 'string') fields.push({ rel: `${trip}/${c.dir ? c.dir + '/' : ''}${f}`, field, value })
      }
    }
  }
}

// Los umbrales (Threshold) no son datos: sus `title`/`dek` son literales del template de TripView,
// y pasan por el mismo `inlineMd`. Se leen del .vue para que la puerta los cubra igual.
const TRIPVIEW = join(__dirname, '../../app/components/TripView.vue')
for (const m of readFileSync(TRIPVIEW, 'utf8').matchAll(/^\s+(title|dek)="([^"]*)"$/gm)) {
  fields.push({ rel: 'app/components/TripView.vue', field: `Threshold ${m[1]}`, value: m[2]! })
}

describe('subset de inlineMd en el corpus', () => {
  it('encuentra los campos inline (guarda contra un descubrimiento vacío)', () => {
    // Si un `pick` deja de casar (renombre de campo, cambio de carpeta), este test se quedaría en
    // verde sin comprobar NADA. La cota inferior lo convierte en rojo.
    expect(fields.length).toBeGreaterThan(80)
  })

  it('ningún campo usa Markdown fuera del subset', () => {
    const bad = fields.flatMap(f =>
      UNSUPPORTED.filter(u => u.re.test(f.value)).map(u => `${f.rel} [${f.field}] → ${u.what}\n    ${JSON.stringify(f.value.slice(0, 90))}`))
    expect(bad, `Campos servidos por inlineMd con Markdown que NO renderiza:\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('no quedan marcas de Markdown sin consumir tras el render', () => {
    // Red de barrido, y el guardián del ÉNFASIS ANIDADO. `inlineMd` es a base de regex, así que
    // anida bien en un sentido y mal en el otro, y la lista de arriba no puede distinguirlos:
    //   ***texto***  y  ***fuerte** y cursiva*  → salen BIEN (idénticos a CommonMark; el corpus
    //                                             de Japón los usa: ***Sengoku***, ***kurofune***)
    //   **fuerte con *cursiva* dentro**         → sale MAL: "*<em>fuerte con </em>…"
    // Lo que separa un caso del otro no es la forma de la marca sino el residuo: cuando el anidado
    // no cuadra, sobra un `*` (o una `` ` ``) en la salida. Comprobarlo sobre el render real, y no
    // sobre el texto de entrada, es lo que hace este test fiable donde una regex de entrada falla.
    const leftovers = fields
      .map(f => ({ ...f, out: inlineMd(f.value) }))
      .filter(f => /[*`]/.test(f.out))
      .map(f => `${f.rel} [${f.field}] → ${JSON.stringify(f.out.slice(0, 90))}`)
    expect(leftovers, `Marcas sin cerrar en campos inline:\n  ${leftovers.join('\n  ')}`).toEqual([])
  })
})

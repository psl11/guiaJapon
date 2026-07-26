import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guardia de los MACRONES en las fuentes vendorizadas.
 *
 * POR QUÉ EXISTE ESTE TEST. Es el heredero directo del test del subset vietnamita de guiaVietnam,
 * donde la plataforma venía con `KEEP_SUBSETS = ['latin', 'latin-ext']` y eso partía "Đồng Văn" a
 * media palabra sin dar ningún error. Aquí el riesgo es menor pero de la misma familia.
 *
 * El romaji japonés necesita macrones —ō y ū— para escribir bien Tōkyō, Kyōto, Kamikōchi o Chūbu.
 * Viven en U+014D, U+016B y compañía, dentro de U+0100-017F, que SÍ cubre `latin-ext`. Es decir:
 * con latin + latin-ext vamos servidos, y a diferencia de Vietnam NO hace falta un tercer subset.
 *
 * Entonces, ¿por qué un test? Porque la premisa "con latin basta" es exactamente la que rompió la
 * guía anterior, y porque el fallo es del tipo silencioso: si alguien regenera las fuentes dejando
 * solo `latin`, las ō y ū caerán a la fuente del sistema a media palabra. No hay tofu, no hay 404,
 * no hay warning — el navegador aplica el fallback y sigue. Solo se ve mirando, y solo si sabes qué
 * mirar. La alternativa (escribir "Tokio" y "Kioto" en castellano en todas partes) es legítima para
 * el cuerpo, pero los nombres en romaji aparecen igual en topónimos y platos.
 *
 * Si este test se pone rojo: `node scripts/vendor-fonts.mjs` y comprobar que `KEEP_SUBSETS`
 * incluye 'latin-ext'.
 */

const FONTS_CSS = join(process.cwd(), 'app/assets/css/fonts.css')

/** Rangos unicode declarados para una familia, aplanados a pares [inicio, fin]. */
function rangosDe(css: string, familia: string): Array<[number, number]> {
  const bloques = [...css.matchAll(
    new RegExp(`font-family: '${familia}';[^}]*?unicode-range: ([^;]+);`, 'gs'),
  )].map(m => m[1]!)
  expect(bloques.length, `no hay ninguna @font-face de ${familia} en fonts.css`).toBeGreaterThan(0)
  return bloques.flatMap(b => b.split(',').map((parte) => {
    const hex = parte.trim().replace(/^U\+/i, '')
    const [a, b2] = hex.split('-')
    const ini = parseInt(a!, 16)
    return [ini, b2 ? parseInt(b2, 16) : ini] as [number, number]
  }))
}

const ord = (ch: string) => ch.codePointAt(0)!
const cubre = (rangos: Array<[number, number]>, ch: string) =>
  rangos.some(([a, b]) => ord(ch) >= a && ord(ch) <= b)

/** Los que salen de verdad en la guía. Si añades un topónimo nuevo, súmalo aquí. */
const NOMBRES = [
  'Tōkyō', 'Kyōto', 'Kamikōchi', 'Chūbu', 'Ōsaka', 'Sensō-ji', 'Kōtoku-in',
  'Shinjuku', 'Hōryū-ji', 'kōyō', 'ryokan', 'Takayama', 'gyūdon', 'Jōmon',
]

describe('fuentes vendorizadas: macrones del romaji', () => {
  const css = readFileSync(FONTS_CSS, 'utf-8')

  it('fonts.css declara caras de latin-ext', () => {
    // U+0100-02BA es la firma del subset latin-ext, donde viven ō y ū. Sin ninguna cara que lo
    // declare, el resto del test no tendría por qué pasar — este assert da el diagnóstico claro.
    expect(css).toContain('0100-02BA')
  })

  it('NO arrastra el subset vietnamita de la guía anterior', () => {
    // Al bifurcar de guiaVietnam se quitaron las 14 caras del subset `vietnamese` (U+1EA0-1EF9):
    // son ~1,5 KB × 14 de peso muerto para una guía sin una sola vocal tonal. Si vuelven a
    // aparecer es que alguien regeneró las fuentes con el KEEP_SUBSETS de Vietnam.
    expect(css).not.toContain('1EA0-1EF9')
  })

  for (const familia of ['Lora', 'Cormorant Garamond'] as const) {
    it(`${familia} cubre todos los nombres en romaji de la guía`, () => {
      const rangos = rangosDe(css, familia)
      const rotos = NOMBRES.flatMap(n =>
        [...n].filter(c => ord(c) > 0x7F && !cubre(rangos, c))
          .map(c => `${n} → ${c} (U+${ord(c).toString(16).toUpperCase().padStart(4, '0')})`),
      )
      expect(rotos, `${familia} no cubre estos caracteres; regenera con vendor-fonts.mjs`).toEqual([])
    })
  }

  it('los macrones concretos están cubiertos (la regresión que se vigila)', () => {
    const rangos = rangosDe(css, 'Lora')
    for (const ch of ['ō', 'ū', 'Ō', 'Ū']) {
      expect(cubre(rangos, ch), `Lora no cubre ${ch}`).toBe(true)
      // Y que sigan donde creemos que están: dentro de latin-ext, no en un subset exótico.
      expect(ord(ch), `${ch} debería estar en el rango latin-ext`).toBeGreaterThanOrEqual(0x0100)
      expect(ord(ch)).toBeLessThanOrEqual(0x017F)
    }
  })
})

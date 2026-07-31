import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Puerta contra el desbordamiento en móvil.
 *
 * La gastronomía sacaba **37 px de scroll horizontal** en un viewport de 375 y no lo veía nadie
 * porque en escritorio no pasa. La causa era una pareja concreta de propiedades en los chips que
 * llevan texto libre: `white-space: nowrap` + `flex-shrink: 0`. Juntas le dicen al elemento que **no
 * puede partir la línea NI encoger**, así que si el contenido es largo —«Uno de los tres grandes
 * mercados matinales de Japón»— estira la fila flex por encima del ancho de la pantalla.
 *
 * Es seguro solo si además trunca (`text-overflow: ellipsis`), que es lo que hace `.gi-label`.
 *
 * jsdom no calcula layout, así que aquí no se puede medir el desbordamiento: lo que se comprueba es
 * la causa, que es estática y basta para impedir la regresión. La medición de verdad se hace en el
 * navegador a 320 y 375 px (ver CLAUDE.md).
 */
const CSS = readFileSync(join(__dirname, '../../app/assets/css/base.css'), 'utf8')

// Trocea el CSS en reglas { selector, cuerpo } ignorando comentarios.
function reglas(css: string) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({
    selector: m[1].replace(/\s+/g, ' ').trim(),
    cuerpo: m[2],
  }))
}

describe('maquetación móvil · nada puede desbordar', () => {
  it('ningún chip de texto libre combina `nowrap` con `flex-shrink: 0`', () => {
    const malos = reglas(CSS)
      .filter(r => /white-space:\s*nowrap/.test(r.cuerpo) && /flex-shrink:\s*0/.test(r.cuerpo))
      .filter(r => !/text-overflow:\s*ellipsis/.test(r.cuerpo)) // truncar sí es seguro
      .map(r => r.selector)

    expect(malos, `Estos selectores no pueden partir línea NI encoger, así que un texto largo
      estirará su fila por encima del viewport y sacará scroll horizontal en móvil:
        ${malos.join('\n        ')}
      → o quitas \`white-space: nowrap\` y añades \`min-width: 0; overflow-wrap: anywhere\`,
        o añades \`text-overflow: ellipsis\` para truncar.`).toEqual([])
  })

  it('la prosa parte las palabras que no caben', () => {
    // El contenido trae dominios («ticket.angkorenterprise.gov.kh», 236 px en una columna de 209),
    // códigos de vuelo y transliteraciones. Sin esto, un solo token rompe la caja.
    const tieneRegla = reglas(CSS).some(r =>
      /\bp\b/.test(r.selector) && /overflow-wrap:\s*(break-word|anywhere)/.test(r.cuerpo))
    expect(tieneRegla, 'Falta la regla que hace que la prosa (p, li, td…) parta las palabras\n' +
      '      demasiado largas. Sin ella un dominio largo saca scroll horizontal en móvil.').toBe(true)
  })

  it('las cabeceras de tarjeta se apilan en pantalla estrecha', () => {
    // El nombre del local y su sello no caben en la misma fila por debajo de ~560 px.
    expect(/@media[^{]*max-width:\s*5[0-9]{2}px[\s\S]*?\.comida-head[^}]*flex-direction:\s*column/.test(CSS),
      'Falta el @media que apila .comida-head en móvil.').toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { inlineMd } from '../../app/utils/inline-md'

/**
 * `inlineMd` — el render de Markdown inline que alimenta seis `v-html` (títulos de acto/día/
 * inversión, lead del acto, dek del umbral, entradilla del hero, epíteto y encabezados de ficha).
 *
 * POR QUÉ SE TESTEA. Dos motivos, y ninguno es cosmético:
 *  1. Va a un `v-html`. Si el escape se rompe, el HTML del corpus deja de ser texto y pasa a ser
 *     markup. El primer test de escape es la red de seguridad de esa decisión.
 *  2. Sustituye a `<MDC unwrap="p">`, que metía un `<div>` dentro de un `<p>` y rompía la
 *     hidratación (ver app/utils/inline-md.ts). El contrato que hace válido el cambio es que la
 *     salida sea la MISMA que daba MDC para el subset que usa el corpus; los casos de abajo son
 *     ese subset, verificados uno a uno contra la salida real de MDC.
 *
 * El guardián de que el corpus no se salga del subset es OTRO test:
 * `tests/data/inline-md-subset.spec.ts` (puerta de datos). Este cubre la función; aquel, los datos.
 */
describe('inlineMd', () => {
  it('escapa el HTML antes de generar markup (va a un v-html)', () => {
    expect(inlineMd('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
    expect(inlineMd('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    // El escape va PRIMERO: las etiquetas que genera el propio helper no se escapan a sí mismas.
    expect(inlineMd('**<b>**')).toBe('<strong>&lt;b&gt;</strong>')
  })

  it('renderiza el subset: código, fuerte y cursiva', () => {
    expect(inlineMd('el `shōjin ryōri` de los templos')).toBe('el <code>shōjin ryōri</code> de los templos')
    expect(inlineMd('**el Tōkaidō**')).toBe('<strong>el Tōkaidō</strong>')
    expect(inlineMd('*Mono no aware*: el Japón que vais a ver'))
      .toBe('<em>Mono no aware</em>: el Japón que vais a ver')
  })

  it('distingue **fuerte** de *cursiva* cuando conviven en la misma frase', () => {
    expect(inlineMd('De *Tokio* a los **Alpes** japoneses'))
      .toBe('De <em>Tokio</em> a los <strong>Alpes</strong> japoneses')
    // El orden de los reemplazos importa: **fuerte** ANTES que *cursiva*, o `**x**` saldría
    // como `<em></em>x<em></em>`. Dos negritas seguidas es el caso que lo destapa.
    expect(inlineMd('**uno** y **dos**')).toBe('<strong>uno</strong> y <strong>dos</strong>')
  })

  it('conserva los saltos de línea del YAML (el wrap lo decide el CSS, no el dato)', () => {
    // Los leads y epítetos vienen en bloque `>-`/multilínea: el `\n` es un salto de línea SUAVE
    // que el navegador colapsa a un espacio, igual que hacía MDC. Si el helper lo tocara, el wrap
    // de la prosa cambiaría respecto al golden.
    expect(inlineMd('una línea\ny otra')).toBe('una línea\ny otra')
  })

  it('deja intacto el texto sin marcas', () => {
    expect(inlineMd('Matsumoto, Kamikōchi y Tokio')).toBe('Matsumoto, Kamikōchi y Tokio')
    expect(inlineMd('')).toBe('')
  })

  it('anida ***fuerte + cursiva*** igual que CommonMark', () => {
    // Sale bien por accidente feliz del orden de los reemplazos (**…** primero deja los asteriscos
    // exteriores, que *…* recoge después), pero es el caso que usa el corpus de Japón
    // (***Sengoku***, ***kurofune***), así que se fija aquí para que nadie lo rompa al "limpiar"
    // las regex. Verificado contra la salida real de MDC.
    expect(inlineMd('***Sengoku***')).toBe('<em><strong>Sengoku</strong></em>')
    expect(inlineMd('***fuerte** y cursiva*')).toBe('<em><strong>fuerte</strong> y cursiva</em>')
  })

  it('NO cubre enlaces ni la cursiva DENTRO de una negrita — por eso existe la puerta de datos', () => {
    // Comportamiento conocido, documentado como tal y no como aspiración. El anidado en el otro
    // sentido (**fuerte con *cursiva* dentro**) sí se rompe, y deja un `*` suelto en la salida:
    // ese residuo es justo lo que detecta `tests/data/inline-md-subset.spec.ts`. Si algún día se
    // añade soporte de enlaces o un parser de verdad, hay que revisar aquella puerta.
    expect(inlineMd('[Kamikōchi](#kamikochi)')).toBe('[Kamikōchi](#kamikochi)')
    expect(inlineMd('**fuerte con *cursiva* dentro**')).toContain('*')
  })
})

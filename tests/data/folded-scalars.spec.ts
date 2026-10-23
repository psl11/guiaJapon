import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// Los cuerpos largos se escriben en YAML plegado (`body: >-`) y se pintan con <MDC>, que es
// Markdown. Las dos sintaxis no cuentan los saltos igual, y el choque no lo ve ningún otro test
// porque el YAML es válido y el esquema pasa (oct 2026: estaba roto en 39 ficheros publicados):
//
// - En plegado, UNA línea en blanco da un solo «\n», que para Markdown es un salto suave: los dos
//   párrafos salían fundidos en uno. Entre párrafos hacen falta DOS líneas en blanco.
// - Dos viñetas en líneas seguidas se pliegan en una sola línea, y la lista salía como un único
//   elemento con «- **Horario:**» en mitad del texto. Entre viñetas hace falta una línea en blanco.
//
// Si un texto necesita otra cosa —sangrías, listas con continuación sangrada—, que vaya en literal
// (`|-`), donde cada salto se queda como está escrito y Markdown lo lee tal cual.

const CONTENT = join(__dirname, '../../content/trips')
const HEAD = /^(\s*)(?:- )?\w+: >-?\s*$/
const ITEM = /^(- |\d+\. )/

function ymls(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? ymls(join(dir, d.name)) : d.name.endsWith('.yml') ? [join(dir, d.name)] : [])
}

const indent = (l: string) => l.length - l.trimStart().length

describe('YAML plegado frente a Markdown', () => {
  it('ni párrafos fundidos ni viñetas pegadas en los escalares `>-`', () => {
    const fallos: string[] = []
    for (const file of ymls(CONTENT)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const m = HEAD.exec(lines[i])
        if (!m) continue
        const base = indent(lines[i])
        const blk: { l: string, n: number }[] = []
        let j = i + 1
        while (j < lines.length && (lines[j].trim() === '' || indent(lines[j]) > base)) blk.push({ l: lines[j], n: ++j })
        const textos = blk.filter(b => b.l.trim() !== '')
        if (!textos.length) continue
        const ci = Math.min(...textos.map(b => indent(b.l)))
        for (let k = 1; k < blk.length; k++) {
          const t = blk[k].l.slice(ci)
          if (t.trim() === '' || indent(blk[k].l) > ci) continue
          const prev = blk[k - 1].l
          const prev2 = blk[k - 2]?.l ?? ''
          const where = `${relative(CONTENT, file)}:${blk[k].n}`
          if (ITEM.test(t) && prev.trim() !== '') fallos.push(`${where} · viñeta pegada a la línea de arriba`)
          if (!ITEM.test(t) && prev.trim() === '' && prev2.trim() !== '') fallos.push(`${where} · párrafo separado por una sola línea en blanco`)
        }
        i = j - 1
      }
    }
    expect(fallos, fallos.join('\n')).toEqual([])
  })
})

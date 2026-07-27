// inlineMd — render de Markdown INLINE propio, sin <MDC>, para títulos, leads, deks y epítetos.
//
// POR QUÉ EXISTE (el bug medido, no una sospecha). `<MDC :value unwrap="p">` NO deja el contenido
// pelado en su contenedor: MDCRenderer envuelve SIEMPRE su salida en un elemento raíz, y ese raíz
// es un `<div>` por defecto (`unwrap="p"` solo quita el `<p>` de dentro, no el div de fuera). El
// SSR emitía, literalmente:
//
//     <p class="acto-lead"><!--[--><div class="">En 1177 una flota…</div><!--]--></p>
//
// Un `<div>` dentro de un `<p>` es HTML inválido, y no de los que el navegador tolera: el parser
// CIERRA el `<p>` al ver el `<div>` y lo saca fuera. El DOM real ya no coincide con el vdom del
// cliente, que sí espera el div DENTRO del `<p>` → «Hydration children mismatch», y el desfase se
// arrastra al hermano siguiente: el `<div class="acto-body">` se reconciliaba contra el div
// desplazado y PERDÍA SU CLASE (verificado: 0 elementos `.acto-body` en el build de producción).
// Eran 13 nodos rotos por carga —el `.lede` del hero, los `.threshold-dek` y los `.acto-lead`— y
// de ahí los «Hydration completed but contains mismatches» de la consola.
//
// Este helper devuelve HTML inline directo (sin componente, sin div, sin fragmento) que va por
// v-html al propio `<h*>`/`<p>`. Es BYTE-IDÉNTICO en servidor y cliente —es una función pura sobre
// un string, no un componente asíncrono—, así que la hidratación no puede desalinearse. De regalo:
// la capitular (`.acto-lead::first-letter`) cae sobre el `<p>` de verdad, y desaparecen ~100
// `useAsyncData` (uno por instancia de MDC) del payload.
//
// SUBSET CUBIERTO — a propósito: escape → `código` → **fuerte** → *cursiva*. Es exactamente lo que
// usa el corpus en estos campos (medido: 169 de 169 campos, salida idéntica a la de MDC). Lo que NO
// cubre —enlaces, énfasis anidado, listas, citas, varios párrafos— saldría en crudo, así que
// `tests/data/inline-md-subset.spec.ts` lo vigila: si alguien escribe un `[enlace](…)` en un lead o
// en un epíteto, la puerta de datos falla y avisa. La prosa larga (bodies, `dek` del día, filas de
// la inversión…) sigue con `<MDC>`, que es Markdown completo y ahí SÍ es correcto: su contenedor es
// un `<div>`, donde el div de MDC es HTML válido y no rompe nada.
export function inlineMd(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

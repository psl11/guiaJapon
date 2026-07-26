// Los clics en anclas internas (#…) se enrutan por Vue Router en vez de dejar el salto nativo del
// navegador. Solo así el router registra la posición de cada entrada y el botón ATRÁS devuelve al
// lector a donde estaba (ver router.options.ts → savedPosition). Un único listener delegado cubre TODO
// de golpe: el índice flotante, los chips «dónde lo veréis» y los enlaces día→ficha del markdown —sin
// necesidad de un handler por componente—. Los enlaces externos (http…, con target=_blank) no casan
// el selector y siguen abriéndose en pestaña nueva.
export default defineNuxtPlugin(() => {
  const router = useRouter()

  document.addEventListener('click', (e) => {
    // respeta cmd/ctrl/mayús-clic (abrir en pestaña/ventana), clic con otro botón, o ya prevenido
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    if (href.length < 2) return // '#' a secas: no hay destino
    const id = decodeURIComponent(href.slice(1))
    if (!document.getElementById(id)) return // ancla inexistente → deja el comportamiento por defecto
    e.preventDefault()
    router.push({ path: router.currentRoute.value.path, hash: `#${id}` })
  })
})

import type { RouterConfig } from '@nuxt/schema'

// La guía es una sola página; toda la navegación es por anclas internas (#acto, #dia-4, #cafe-giang…).
// Este scrollBehavior hace la navegación "súper usable":
//  · al ir a un ancla → desplázate con un offset de 84px para que la topbar fija no tape el destino;
//  · al pulsar ATRÁS/adelante → `savedPosition` devuelve al lector EXACTAMENTE a donde estaba leyendo.
// Requiere que los clics internos pasen por el router (ver plugins/anchor-nav.client.ts), porque solo
// entonces Vue Router registra la posición de cada entrada del historial.
export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition // atrás/adelante: vuelve a la posición de lectura
    if (to.hash) {
      const reduce = import.meta.client
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      return { el: to.hash, top: 84, behavior: reduce ? 'auto' : 'smooth' }
    }
    return { top: 0 }
  },
}

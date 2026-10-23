// esPost — si el `url` de un recomendado es un post de redes o una fuente cualquiera.
//
// En los de Alba, `url` es siempre el reel o el post del que salió el sitio. En los de Pablo suele
// ser la página que verifica el dato —una noticia, la web oficial—, porque la recomendación viene de
// haber ido él. El enlace no puede decir «Ver el post» en los dos casos: con una web oficial detrás,
// promete un vídeo que no existe.
export function esPost(url: string): boolean {
  return /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(url)
}

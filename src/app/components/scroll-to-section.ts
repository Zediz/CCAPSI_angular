import { Router } from '@angular/router';

/**
 * Navega a una sección de la landing (`/#id`). Si ya estamos en la landing
 * hace scroll suave sin cambiar de ruta, igual que los anchors del sitio original.
 */
export function scrollToSection(router: Router, id: string, event?: Event): void {
  event?.preventDefault();
  const onLanding = router.url.split(/[?#]/)[0] === '/';
  const target = onLanding ? document.getElementById(id) : null;
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    router.navigate(['/'], { fragment: id });
  }
}

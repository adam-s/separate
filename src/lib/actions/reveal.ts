/**
 * Svelte action: fade-and-rise an element into view the first time it scrolls in.
 * Progressive enhancement — content is visible by default; the action only opts into
 * the animation, and skips it entirely under prefers-reduced-motion.
 */
export function reveal(node: HTMLElement, opts: { delay?: number } = {}) {
  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof IntersectionObserver === 'undefined') return;

  node.classList.add('reveal-init');
  if (opts.delay) node.style.transitionDelay = `${opts.delay}ms`;

  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          node.classList.add('is-revealed');
          obs.unobserve(node);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
  );
  obs.observe(node);

  return { destroy: () => obs.disconnect() };
}

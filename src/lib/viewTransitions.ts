import { flushSync } from 'react-dom';

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export function startPageTransition(update: () => void) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const root = document.getElementById('root');
  const startViewTransition = (document as TransitionDocument).startViewTransition;

  if (startViewTransition) {
    startViewTransition.call(document, () => flushSync(update));
    return;
  }

  if (!root) {
    update();
    return;
  }

  root.classList.add('route-transition-exit');
  window.setTimeout(() => {
    flushSync(update);
    root.classList.remove('route-transition-exit');
    root.classList.add('route-transition-enter');
    window.setTimeout(() => root.classList.remove('route-transition-enter'), 340);
  }, 180);
}

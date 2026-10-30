import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 700;

// Sin matchMedia (p. ej. en jsdom) o con animaciones reducidas, el número se muestra directo.
function animationsAllowed(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

// Cuenta del valor anterior al nuevo (o desde 0 la primera vez) con salida suave.
export function useCountUp(target: number): number {
  const [shown, setShown] = useState(() => (animationsAllowed() ? 0 : target));
  const current = useRef(shown);

  useEffect(() => {
    if (!animationsAllowed()) {
      current.current = target;
      setShown(target);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const value = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      current.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

import { useEffect, useState } from 'react';

// Tiempo que se muestra el resultado antes de volver al texto original.
const FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

const LABELS: Record<CopyState, string> = {
  idle: 'Copiar enlace',
  copied: '¡Copiado!',
  failed: 'No se pudo copiar',
};

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      // navigator.clipboard solo existe en contextos seguros (https o localhost).
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <button type="button" className="copy-button" title={text} onClick={copy}>
      {LABELS[state]}
    </button>
  );
}

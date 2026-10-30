import { useEffect, useState } from 'react';
import { Icon } from './Icon.tsx';
import type { IconName } from './Icon.tsx';

// Tiempo que se muestra el resultado antes de volver al texto original.
const FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

const LABELS: Record<CopyState, string> = {
  idle: 'Copiar enlace',
  copied: '¡Copiado!',
  failed: 'No se pudo copiar',
};

const ICONS: Record<CopyState, IconName> = {
  idle: 'copy',
  copied: 'check',
  failed: 'x',
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
    <button type="button" className={`copy-button with-icon is-${state}`} title={text} onClick={copy}>
      <Icon name={ICONS[state]} size={15} />
      {LABELS[state]}
    </button>
  );
}

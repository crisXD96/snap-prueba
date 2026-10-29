import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Sin globals de Vitest, Testing Library no desmonta solo entre tests.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

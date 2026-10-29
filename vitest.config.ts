import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Dos proyectos para que los tests del backend sigan en Node y los de la SPA usen un DOM.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/web/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/web/**/__tests__/**/*.test.{ts,tsx}'],
          setupFiles: ['src/web/__tests__/setup.ts'],
        },
      },
    ],
  },
});

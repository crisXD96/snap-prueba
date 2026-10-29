import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { SessionProvider } from './session.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Falta el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);

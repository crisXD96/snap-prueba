import { useState } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import { LoginForm } from './components/LoginForm.tsx';
import { RegisterForm } from './components/RegisterForm.tsx';
import { useSession } from './session.tsx';

// Sin rutas en la URL: la vista depende de la sesión, así no choca con /:code ni con /dashboard.
export function App() {
  const { session, notice, signOut } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Snap</span>
        {session && (
          <div className="user">
            <span>{session.user.name}</span>
            <button type="button" className="link-button" onClick={() => signOut()}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main>
        {session ? (
          <Dashboard />
        ) : (
          <section className="auth card">
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
            <p className="auth-switch">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button type="button" className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

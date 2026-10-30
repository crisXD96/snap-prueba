import { useState } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import { Icon } from './components/Icon.tsx';
import { LoginForm } from './components/LoginForm.tsx';
import { RegisterForm } from './components/RegisterForm.tsx';
import { useSession } from './session.tsx';

// Sin rutas en la URL: la vista depende de la sesión, así no choca con /:code ni con /dashboard.
export function App() {
  const { session, checking, notice, signOut } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">
          <span className="brand-mark">
            <Icon name="link" size={18} />
          </span>
          Snap
        </span>
        {session && (
          <div className="user">
            <span className="avatar" aria-hidden="true">
              {session.user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="user-name">{session.user.name}</span>
            <button type="button" className="link-button with-icon" onClick={() => signOut()}>
              <Icon name="log-out" size={16} />
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main>
        {checking ? (
          <p className="checking muted">
            <Icon name="refresh-cw" className="spin" />
            Comprobando tu sesión…
          </p>
        ) : session ? (
          <Dashboard />
        ) : (
          <div className="auth-layout">
            <section className="auth-hero">
              <p className="auth-kicker">
                <Icon name="zap" size={16} />
                Enlaces cortos con analíticas
              </p>
              <p className="auth-title">Acorta, comparte y mide cada click.</p>
              <ul className="auth-points">
                <li>
                  <Icon name="scissors" size={18} />
                  Enlaces de 7 caracteres listos para copiar
                </li>
                <li>
                  <Icon name="bar-chart" size={18} />
                  Clicks por día en 7, 30 o 90 días
                </li>
                <li>
                  <Icon name="refresh-cw" size={18} />
                  Métricas que se actualizan solas
                </li>
              </ul>
            </section>
            <section className="auth card" key={mode}>
              {notice && (
                <p className="notice" role="status">
                  <Icon name="circle-alert" size={18} />
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
          </div>
        )}
      </main>
    </div>
  );
}

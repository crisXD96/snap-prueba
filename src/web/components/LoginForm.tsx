import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, login, UNEXPECTED_ERROR } from '../api.ts';
import { useSession } from '../session.tsx';
import { Icon } from './Icon.tsx';

export function LoginForm() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      signIn(await login(email, password));
    } catch (caught) {
      // Aquí un 401 son credenciales incorrectas, no una sesión expirada.
      setError(caught instanceof ApiError ? caught.message : UNEXPECTED_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <h1>Inicia sesión</h1>
        <p className="muted">Entra para ver tus enlaces y sus clicks.</p>
      </div>
      <label>
        Email
        <span className="field">
          <Icon name="mail" />
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </span>
      </label>
      <label>
        Password
        <span className="field">
          <Icon name="lock" />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </span>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary with-icon" disabled={submitting}>
        <Icon name="log-in" />
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

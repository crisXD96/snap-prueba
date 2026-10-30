import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, register, UNEXPECTED_ERROR } from '../api.ts';
import { useSession } from '../session.tsx';
import { Icon } from './Icon.tsx';

// Debe coincidir con la regla del backend; el backend sigue siendo quien valida.
const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      signIn(await register({ name, email, password }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : UNEXPECTED_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <h1>Crea tu cuenta</h1>
        <p className="muted">Empieza a acortar enlaces en segundos.</p>
      </div>
      <label>
        Nombre
        <span className="field">
          <Icon name="user" />
          <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </span>
      </label>
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </span>
      </label>
      <p className="hint">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary with-icon" disabled={submitting}>
        <Icon name="user-plus" />
        {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

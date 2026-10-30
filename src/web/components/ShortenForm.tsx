import { useState } from 'react';
import type { FormEvent } from 'react';
import { shorten } from '../api.ts';
import type { ShortUrl } from '../api.ts';
import { shortUrl } from '../format.ts';
import { useErrorMessage, useToken } from '../session.tsx';
import { CopyButton } from './CopyButton.tsx';
import { Icon } from './Icon.tsx';

interface ShortenFormProps {
  // Lo guarda el panel para quitar el aviso si después se borra esa URL.
  created: ShortUrl | null;
  onCreatedChange: (created: ShortUrl | null) => void;
}

export function ShortenForm({ created, onCreatedChange }: ShortenFormProps) {
  const token = useToken();
  const toMessage = useErrorMessage();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    onCreatedChange(null);
    try {
      onCreatedChange(await shorten(token, url));
      setUrl('');
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card shorten-card">
      {/* type="text" y no "url": el backend acepta dominios sin esquema y les agrega https://. */}
      <form className="shorten" onSubmit={handleSubmit}>
        <label>
          URL a acortar
          <span className="field field-large">
            <Icon name="link" />
            <input
              type="text"
              inputMode="url"
              placeholder="ejemplo.com/una-pagina-larga"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </span>
        </label>
        <button type="submit" className="primary with-icon" disabled={submitting}>
          <Icon name="scissors" className={submitting ? 'spin' : undefined} />
          {submitting ? 'Acortando…' : 'Acortar'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {created && (
        // key: cada URL nueva vuelve a montar el aviso y repite su animación de entrada.
        <div className="created" key={created.code}>
          <Icon name="circle-check" size={22} className="created-icon" />
          <p role="status">
            Listo:{' '}
            <a href={shortUrl(created.code)} target="_blank" rel="noreferrer">
              {shortUrl(created.code)}
            </a>{' '}
            → <span className="muted created-target">{created.url}</span>
          </p>
          <CopyButton text={shortUrl(created.code)} />
        </div>
      )}
    </section>
  );
}

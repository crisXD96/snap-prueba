import { useState } from 'react';
import { removeUrl } from '../api.ts';
import type { DashboardUrl } from '../api.ts';
import { formatDateTime, formatNumber, shortUrl } from '../format.ts';
import { useErrorMessage, useToken } from '../session.tsx';
import { CopyButton } from './CopyButton.tsx';
import { Icon } from './Icon.tsx';

interface UrlListProps {
  items: DashboardUrl[];
  hasMore: boolean;
  loadingMore: boolean;
  // La recién creada se resalta con una animación al aparecer en la lista.
  highlightCode: string | null;
  onLoadMore: () => void;
  onRemoved: (code: string) => void;
}

export function UrlList({ items, hasMore, loadingMore, highlightCode, onLoadMore, onRemoved }: UrlListProps) {
  const token = useToken();
  const toMessage = useErrorMessage();
  // Borrar pide una segunda confirmación en la misma fila, sin diálogos del navegador.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(code: string) {
    setRemoving(code);
    setError(null);
    try {
      await removeUrl(token, code);
      setConfirming(null);
      onRemoved(code);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="card">
      <h2 className="with-icon">
        <Icon name="link" />
        Tus URLs
      </h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="empty">
          <Icon name="inbox" size={36} />
          <p className="muted">Aún no has acortado ninguna URL.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="url-table">
            <thead>
              <tr>
                <th scope="col">Enlace corto</th>
                <th scope="col">Destino</th>
                <th scope="col">Clicks</th>
                <th scope="col">Creada</th>
                <th scope="col">Último click</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.code} className={item.code === highlightCode ? 'is-new' : undefined}>
                  <td>
                    <a className="code-pill" href={shortUrl(item.code)} target="_blank" rel="noreferrer">
                      {item.code}
                    </a>
                  </td>
                  {/* data-label: en pantallas angostas cada fila se muestra como tarjeta con estas etiquetas. */}
                  <td className="destination" data-label="Destino">
                    <a href={item.url} target="_blank" rel="noreferrer" title={item.url}>
                      {item.url}
                    </a>
                  </td>
                  <td className="number" data-label="Clicks">
                    {formatNumber(item.clicks)}
                  </td>
                  <td data-label="Creada">{formatDateTime(item.createdAt)}</td>
                  <td data-label="Último click">{formatDateTime(item.lastClickAt)}</td>
                  <td>
                    <div className="actions">
                      <CopyButton text={shortUrl(item.code)} />
                      {confirming === item.code ? (
                        <>
                          <button
                            type="button"
                            className="danger with-icon"
                            disabled={removing === item.code}
                            onClick={() => handleRemove(item.code)}
                          >
                            <Icon name="trash" size={15} />
                            Confirmar borrado
                          </button>
                          <button type="button" className="link-button" onClick={() => setConfirming(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="link-button with-icon delete-button"
                          aria-label={`Borrar ${item.code}`}
                          onClick={() => setConfirming(item.code)}
                        >
                          <Icon name="trash" size={15} />
                          Borrar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <button type="button" className="secondary with-icon load-more" disabled={loadingMore} onClick={onLoadMore}>
          <Icon name={loadingMore ? 'refresh-cw' : 'chevron-down'} className={loadingMore ? 'spin' : undefined} />
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </section>
  );
}

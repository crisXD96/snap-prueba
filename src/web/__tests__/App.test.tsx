import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardUrl } from '../api.ts';
import { App } from '../App.tsx';
import { SessionProvider } from '../session.tsx';
import { ana, fakeToken, jsonResponse, mockFetch, overview, urlItem } from './fetch-mock.ts';

function renderApp() {
  render(
    <SessionProvider>
      <App />
    </SessionProvider>,
  );
  return userEvent.setup();
}

async function signInAsAna(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'ana@example.com');
  await user.type(screen.getByLabelText('Password'), 'contraseña-segura');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

const loginOk = () => jsonResponse(200, { user: ana, token: fakeToken() });

// La fila de la tabla donde aparece el enlace corto de ese código.
async function findRow(code: string): Promise<HTMLElement> {
  const row = (await screen.findByRole('link', { name: code })).closest('tr');
  if (!row) {
    throw new Error(`No hay fila para ${code}`);
  }
  return row;
}

describe('SPA de Snap', () => {
  it('inicia sesión y muestra el panel con las métricas del usuario', async () => {
    const fetchMock = mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () =>
        jsonResponse(
          200,
          overview([urlItem('aB3xK9z', { clicks: 21 })], {
            totals: { urls: 1, clicks: 340, urlsWithoutClicks: 0, lastClickAt: '2026-10-29T17:00:00.000Z' },
          }),
        ),
    });
    const user = renderApp();

    await signInAsAna(user);

    const metrics = await screen.findByRole('region', { name: 'Métricas' });
    expect(within(metrics).getByText('340')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'aB3xK9z' }).getAttribute('href')).toBe(`${window.location.origin}/aB3xK9z`);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: expect.stringMatching(/^Bearer /) });
  });

  it('muestra el error del backend cuando las credenciales son incorrectas', async () => {
    mockFetch({ 'POST /auth/login': () => jsonResponse(401, { error: 'Email o password incorrectos' }) });
    const user = renderApp();

    await signInAsAna(user);

    expect((await screen.findByRole('alert')).textContent).toBe('Email o password incorrectos');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('registra una cuenta nueva y entra al panel', async () => {
    const fetchMock = mockFetch({
      'POST /auth/register': () => jsonResponse(201, { user: ana, token: fakeToken() }),
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
    });
    const user = renderApp();

    await user.click(screen.getByRole('button', { name: 'Regístrate' }));
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'contraseña-segura');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Aún no has acortado ninguna URL.')).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'contraseña-segura',
    });
  });

  it('acorta una URL, muestra el enlace corto y recarga la lista', async () => {
    let urls = [urlItem('old0001')];
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview(urls)),
      'POST /urls': () => {
        urls = [urlItem('new0001', { url: 'https://ejemplo.com/pagina' }), ...urls];
        return jsonResponse(201, { code: 'new0001', url: 'https://ejemplo.com/pagina' });
      },
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.type(await screen.findByLabelText('URL a acortar'), 'ejemplo.com/pagina');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));

    expect((await screen.findByRole('status')).textContent).toContain(`${window.location.origin}/new0001`);
    expect(await screen.findByRole('link', { name: 'new0001' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'old0001' })).toBeTruthy();
    expect((screen.getByLabelText('URL a acortar') as HTMLInputElement).value).toBe('');
  });

  it('copia el enlace recién creado desde el aviso de éxito', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
      'POST /urls': () => jsonResponse(201, { code: 'new0001', url: 'https://ejemplo.com' }),
    });
    const user = renderApp();
    await signInAsAna(user);
    await user.type(await screen.findByLabelText('URL a acortar'), 'ejemplo.com');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));

    const notice = (await screen.findByRole('status')).parentElement;
    if (!notice) throw new Error('Falta el aviso de éxito');
    await user.click(within(notice).getByRole('button', { name: 'Copiar enlace' }));

    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/new0001`);
    expect(within(notice).getByRole('button', { name: '¡Copiado!' })).toBeTruthy();
  });

  it('copia el enlace corto de una URL de la lista', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview([urlItem('aB3xK9z'), urlItem('zZ9yY8x')])),
    });
    const user = renderApp();
    await signInAsAna(user);

    const row = await findRow('zZ9yY8x');
    await user.click(within(row).getByRole('button', { name: 'Copiar enlace' }));

    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/zZ9yY8x`);
    expect(within(row).getByRole('button', { name: '¡Copiado!' })).toBeTruthy();
    expect(within(await findRow('aB3xK9z')).getByRole('button', { name: 'Copiar enlace' })).toBeTruthy();
  });

  it('avisa cuando el navegador no deja copiar', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview([urlItem('aB3xK9z')])),
    });
    const user = renderApp();
    await signInAsAna(user);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Permiso denegado', 'NotAllowedError'));

    const row = await findRow('aB3xK9z');
    await user.click(within(row).getByRole('button', { name: 'Copiar enlace' }));

    expect(within(row).getByRole('button', { name: 'No se pudo copiar' })).toBeTruthy();
  });

  it('muestra el error de validación al acortar una URL inválida', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
      'POST /urls': () => jsonResponse(400, { error: 'La url debe ser http o https' }),
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.type(await screen.findByLabelText('URL a acortar'), 'ftp://ejemplo.com');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));

    expect((await screen.findByRole('alert')).textContent).toBe('La url debe ser http o https');
    expect((screen.getByLabelText('URL a acortar') as HTMLInputElement).value).toBe('ftp://ejemplo.com');
  });

  it('actualiza las métricas a petición sin recargar la página', async () => {
    let totalClicks = 0;
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () =>
        jsonResponse(
          200,
          overview([urlItem('aB3xK9z')], {
            totals: { urls: 1, clicks: totalClicks, urlsWithoutClicks: totalClicks === 0 ? 1 : 0, lastClickAt: null },
          }),
        ),
    });
    const user = renderApp();
    await signInAsAna(user);
    const metrics = await screen.findByRole('region', { name: 'Métricas' });
    expect(within(metrics).queryByText('17')).toBeNull();

    totalClicks = 17;
    await user.click(await screen.findByRole('button', { name: 'Actualizar métricas' }));

    expect(await within(metrics).findByText('17')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Actualizar métricas' })).toBeTruthy();
  });

  it('cierra la sesión si el token deja de ser válido a mitad del uso', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
      'POST /urls': () => jsonResponse(401, { error: 'Token inválido o expirado' }),
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.type(await screen.findByLabelText('URL a acortar'), 'ejemplo.com');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));

    expect((await screen.findByRole('status')).textContent).toBe('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
    expect(screen.queryByLabelText('URL a acortar')).toBeNull();
  });

  it('un 403 muestra el mensaje del servidor sin cerrar la sesión', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview([urlItem('aB3xK9z')])),
      'DELETE /urls/aB3xK9z': () => jsonResponse(403, { error: 'La url pertenece a otro usuario' }),
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.click(await screen.findByRole('button', { name: 'Borrar aB3xK9z' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    expect((await screen.findByRole('alert')).textContent).toBe('La url pertenece a otro usuario');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('borra una URL solo después de confirmarlo', async () => {
    let urls = [urlItem('aB3xK9z')];
    const fetchMock = mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview(urls)),
      'DELETE /urls/aB3xK9z': () => {
        urls = [];
        return new Response(null, { status: 204 });
      },
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.click(await screen.findByRole('button', { name: 'Borrar aB3xK9z' }));
    const deletesBeforeConfirm = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length;
    await user.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    expect(deletesBeforeConfirm).toBe(0);
    expect(await screen.findByText('Aún no has acortado ninguna URL.')).toBeTruthy();
  });

  it('quita el aviso de la URL recién creada cuando se borra esa URL', async () => {
    let urls: DashboardUrl[] = [];
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview(urls)),
      'POST /urls': () => {
        urls = [urlItem('new0001')];
        return jsonResponse(201, { code: 'new0001', url: 'https://example.com/new0001' });
      },
      'DELETE /urls/new0001': () => {
        urls = [];
        return new Response(null, { status: 204 });
      },
    });
    const user = renderApp();
    await signInAsAna(user);
    await user.type(await screen.findByLabelText('URL a acortar'), 'example.com/new0001');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));
    expect(await screen.findByRole('status')).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Borrar new0001' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    expect(await screen.findByText('Aún no has acortado ninguna URL.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('mantiene el aviso de la URL recién creada cuando se borra otra URL', async () => {
    let urls = [urlItem('old0001')];
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview(urls)),
      'POST /urls': () => {
        urls = [urlItem('new0001'), ...urls];
        return jsonResponse(201, { code: 'new0001', url: 'https://example.com/new0001' });
      },
      'DELETE /urls/old0001': () => {
        urls = urls.filter((item) => item.code !== 'old0001');
        return new Response(null, { status: 204 });
      },
    });
    const user = renderApp();
    await signInAsAna(user);
    await user.type(await screen.findByLabelText('URL a acortar'), 'example.com/new0001');
    await user.click(screen.getByRole('button', { name: 'Acortar' }));
    await screen.findByRole('link', { name: 'new0001' });

    await user.click(screen.getByRole('button', { name: 'Borrar old0001' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'old0001' })).toBeNull());
    expect(screen.getByRole('status').textContent).toContain(`${window.location.origin}/new0001`);
  });

  it('carga la siguiente página de URLs con el cursor', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () =>
        jsonResponse(200, overview([urlItem('page001')], { urls: { items: [urlItem('page001')], nextCursor: 'c1' } })),
      'GET /dashboard?days=7&cursor=c1': () => jsonResponse(200, overview([urlItem('page002')])),
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('link', { name: 'page002' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'page001' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('descarta la página siguiente si la lista se recargó mientras llegaba', async () => {
    let deliverNextPage: (res: Response) => void = () => {};
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () =>
        jsonResponse(200, overview([urlItem('page001')], { urls: { items: [urlItem('page001')], nextCursor: 'c1' } })),
      'GET /dashboard?days=7&cursor=c1': () =>
        new Promise<Response>((resolve) => {
          deliverNextPage = resolve;
        }),
    });
    const user = renderApp();
    await signInAsAna(user);
    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));
    await user.click(screen.getByRole('button', { name: 'Actualizar métricas' }));
    await screen.findByRole('button', { name: 'Actualizar métricas' });

    deliverNextPage(jsonResponse(200, overview([urlItem('page002')])));

    expect(await screen.findByRole('button', { name: 'Cargar más' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'page002' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'page001' })).toHaveLength(1);
  });

  it('pide el dashboard del periodo elegido', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
      'GET /dashboard?days=30': () =>
        jsonResponse(200, overview([], { period: { days: 30, from: '2026-09-30', to: '2026-10-29', utcOffset: '-06:00' } })),
    });
    const user = renderApp();
    await signInAsAna(user);

    await user.click(await screen.findByRole('button', { name: '30 días' }));

    expect(await screen.findByText('Clicks en 30 días')).toBeTruthy();
  });

  it('vuelve al login con aviso cuando el backend rechaza el token', async () => {
    mockFetch({
      'POST /auth/login': loginOk,
      'GET /dashboard?days=7': () => jsonResponse(401, { error: 'Token inválido o expirado' }),
    });
    const user = renderApp();

    await signInAsAna(user);

    expect((await screen.findByRole('status')).textContent).toBe('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('cierra la sesión cuando expira el token', async () => {
    mockFetch({
      'POST /auth/login': () => jsonResponse(200, { user: ana, token: fakeToken(-1) }),
      'GET /dashboard?days=7': () => jsonResponse(200, overview()),
    });
    const user = renderApp();

    await signInAsAna(user);

    expect((await screen.findByRole('status')).textContent).toBe('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
  });
});

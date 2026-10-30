import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, getSession, logout, UNEXPECTED_ERROR } from './api.ts';
import type { SessionInfo, User } from './api.ts';

export const SESSION_EXPIRED = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';

// El token vive en una cookie HttpOnly que el JavaScript no puede leer: aquí solo están el
// usuario y cuándo vence, que manda el servidor.
interface Session {
  user: User;
  expiresAt: number;
}

interface SessionContextValue {
  session: Session | null;
  // Mientras se pregunta al servidor si la cookie sigue valiendo, p. ej. al recargar la página.
  checking: boolean;
  // Aviso para la pantalla de login, p. ej. por qué se cerró la sesión.
  notice: string | null;
  signIn(info: SessionInfo): void;
  signOut(notice?: string): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function toSession({ user, expiresAt }: SessionInfo): Session {
  // Sin una fecha legible la sesión dura hasta que el backend responda 401.
  return { user, expiresAt: Date.parse(expiresAt) };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getSession()
      .then(
        (info) => {
          if (!ignore) setSession(toSession(info));
        },
        // Sin cookie o con una vencida el servidor responde 401: se muestra el login.
        () => {},
      )
      .finally(() => {
        if (!ignore) setChecking(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const signIn = useCallback((info: SessionInfo) => {
    setSession(toSession(info));
    setNotice(null);
  }, []);

  const signOut = useCallback((nextNotice?: string) => {
    // Borra la cookie en el servidor; si falla, la cookie vence sola y el panel ya no se muestra.
    logout().catch(() => {});
    setSession(null);
    setNotice(nextNotice ?? null);
  }, []);

  useEffect(() => {
    if (!session || !Number.isFinite(session.expiresAt)) return undefined;
    const timer = setTimeout(() => signOut(SESSION_EXPIRED), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo(
    () => ({ session, checking, notice, signIn, signOut }),
    [session, checking, notice, signIn, signOut],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession requiere un SessionProvider');
  }
  return value;
}

// Traduce un error de la API al mensaje a mostrar. Un 401 cierra la sesión y devuelve null.
// Un 403 no: en esta API significa que el recurso es de otro usuario, no que el token falló.
export function useErrorMessage(): (error: unknown) => string | null {
  const { signOut } = useSession();
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        signOut(SESSION_EXPIRED);
        return null;
      }
      return error instanceof ApiError ? error.message : UNEXPECTED_ERROR;
    },
    [signOut],
  );
}

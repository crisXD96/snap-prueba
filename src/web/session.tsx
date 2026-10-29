import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from './api.ts';
import type { AuthResult, User } from './api.ts';

export const SESSION_EXPIRED = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';

// El token vive solo en memoria: las reglas del equipo prohíben guardarlo en storage del navegador.
interface Session {
  token: string;
  user: User;
  expiresAt: number;
}

interface SessionContextValue {
  session: Session | null;
  // Aviso para la pantalla de login, p. ej. por qué se cerró la sesión.
  notice: string | null;
  signIn(result: AuthResult): void;
  signOut(notice?: string): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Lee exp del JWT sin verificarlo: solo sirve para cerrar la sesión a tiempo; quien valida es el backend.
function tokenExpiresAt(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    if (typeof exp === 'number') return exp * 1000;
  } catch {
    // Sin exp legible la sesión dura hasta que el backend responda 401.
  }
  return Number.POSITIVE_INFINITY;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signIn = useCallback(({ token, user }: AuthResult) => {
    setSession({ token, user, expiresAt: tokenExpiresAt(token) });
    setNotice(null);
  }, []);

  const signOut = useCallback((nextNotice?: string) => {
    setSession(null);
    setNotice(nextNotice ?? null);
  }, []);

  useEffect(() => {
    if (!session || !Number.isFinite(session.expiresAt)) return undefined;
    const timer = setTimeout(() => signOut(SESSION_EXPIRED), Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo(() => ({ session, notice, signIn, signOut }), [session, notice, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession requiere un SessionProvider');
  }
  return value;
}

// Para las vistas con sesión: devuelve el token (siempre existe dentro del panel).
export function useToken(): string {
  const { session } = useSession();
  if (!session) {
    throw new Error('useToken solo se usa con una sesión iniciada');
  }
  return session.token;
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
      return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';
    },
    [signOut],
  );
}

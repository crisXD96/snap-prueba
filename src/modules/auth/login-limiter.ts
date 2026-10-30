const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
// Cada email distinto ocupa una entrada: sin tope, probar muchos emails llenaría la memoria.
const MAX_TRACKED_KEYS = 10_000;

interface Failures {
  count: number;
  firstAt: number;
}

export interface LoginLimiter {
  // Segundos que faltan para volver a intentar, o undefined si la clave puede intentar ya.
  retryAfter(key: string): number | undefined;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export interface LoginLimiterOptions {
  now?: () => number;
  maxTrackedKeys?: number;
}

// En memoria del proceso: se pierde al reiniciar y no se comparte entre instancias.
// Alcanza mientras la app corra en un solo proceso, como exige SQLite.
export function createLoginLimiter({ now = Date.now, maxTrackedKeys = MAX_TRACKED_KEYS }: LoginLimiterOptions = {}): LoginLimiter {
  const failures = new Map<string, Failures>();

  function current(key: string): Failures | undefined {
    const entry = failures.get(key);
    if (entry && now() - entry.firstAt >= WINDOW_MS) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  }

  function makeRoom(): void {
    for (const key of failures.keys()) {
      if (failures.size < maxTrackedKeys) return;
      current(key);
    }
    // El Map conserva el orden de inserción: la primera clave es la más antigua.
    while (failures.size >= maxTrackedKeys) {
      const oldest = failures.keys().next().value;
      if (oldest === undefined) return;
      failures.delete(oldest);
    }
  }

  return {
    retryAfter(key) {
      const entry = current(key);
      if (!entry || entry.count < MAX_FAILURES) return undefined;
      return Math.ceil((entry.firstAt + WINDOW_MS - now()) / 1000);
    },

    recordFailure(key) {
      const entry = current(key);
      if (entry) {
        entry.count += 1;
        return;
      }
      makeRoom();
      failures.set(key, { count: 1, firstAt: now() });
    },

    reset(key) {
      failures.delete(key);
    },
  };
}

import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from '../login-limiter.ts';

const MINUTE = 60 * 1000;

function clock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('límite de intentos de login', () => {
  it('permite hasta 5 fallos y bloquea el sexto intento durante el resto de la ventana', () => {
    const time = clock();
    const limiter = createLoginLimiter({ now: time.now });

    for (let i = 0; i < 5; i++) {
      expect(limiter.retryAfter('ip|ana@example.com')).toBeUndefined();
      limiter.recordFailure('ip|ana@example.com');
    }
    time.advance(5 * MINUTE);

    expect(limiter.retryAfter('ip|ana@example.com')).toBe(10 * 60);
  });

  it('vuelve a permitir intentos cuando pasan los 15 minutos desde el primer fallo', () => {
    const time = clock();
    const limiter = createLoginLimiter({ now: time.now });
    for (let i = 0; i < 5; i++) limiter.recordFailure('ip|ana@example.com');

    time.advance(15 * MINUTE);

    expect(limiter.retryAfter('ip|ana@example.com')).toBeUndefined();
  });

  it('cuenta cada clave por separado', () => {
    const limiter = createLoginLimiter({ now: clock().now });
    for (let i = 0; i < 5; i++) limiter.recordFailure('ip|ana@example.com');

    expect(limiter.retryAfter('ip|bea@example.com')).toBeUndefined();
    expect(limiter.retryAfter('otra-ip|ana@example.com')).toBeUndefined();
  });

  it('reiniciar una clave borra sus fallos', () => {
    const limiter = createLoginLimiter({ now: clock().now });
    for (let i = 0; i < 4; i++) limiter.recordFailure('ip|ana@example.com');

    limiter.reset('ip|ana@example.com');
    for (let i = 0; i < 4; i++) limiter.recordFailure('ip|ana@example.com');

    expect(limiter.retryAfter('ip|ana@example.com')).toBeUndefined();
  });

  it('no guarda más claves que el máximo aunque lleguen fallos de muchas distintas', () => {
    const limiter = createLoginLimiter({ now: clock().now, maxTrackedKeys: 3 });
    for (let i = 0; i < 5; i++) limiter.recordFailure('ip|vieja@example.com');

    for (const email of ['a', 'b', 'c']) limiter.recordFailure(`ip|${email}@example.com`);

    // La clave más antigua se descarta para dejar lugar: la memoria no crece sin tope.
    expect(limiter.retryAfter('ip|vieja@example.com')).toBeUndefined();
  });
});

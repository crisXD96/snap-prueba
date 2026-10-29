import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRecord, UsersRepository } from './auth.repository.ts';

const BCRYPT_COST = 10;
const TOKEN_TTL = '24h';
const MIN_PASSWORD_LENGTH = 8;
// bcrypt ignora lo que pasa de 72 bytes: dos passwords con ese mismo inicio valdrían igual.
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {}

export class EmailAlreadyRegisteredError extends Error {}

// Un solo error para email inexistente y password incorrecto: no revela qué emails existen.
export class InvalidCredentialsError extends Error {}

// Los campos llegan sin tipar desde el body HTTP; el servicio los valida.
export interface RegisterInput {
  email: unknown;
  password: unknown;
  name: unknown;
}

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(email: unknown, password: unknown): Promise<AuthResult>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertRegisterInput({ email, password, name }: RegisterInput): { email: string; password: string; name: string } {
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(normalizeEmail(email))) {
    throw new ValidationError('El email no es válido');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`El password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`El password no puede superar ${MAX_PASSWORD_BYTES} bytes`);
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('El nombre es obligatorio');
  }
  return { email: normalizeEmail(email), password, name: name.trim() };
}

function toPublicUser({ id, email, name, createdAt }: UserRecord): PublicUser {
  return { id, email, name, createdAt };
}

// El secreto llega desde fuera para que nunca viva en el código.
export function createAuthService(repository: UsersRepository, jwtSecret: string): AuthService {
  function authResult(user: UserRecord): AuthResult {
    const token = jwt.sign({ email: user.email }, jwtSecret, {
      algorithm: 'HS256',
      subject: String(user.id),
      expiresIn: TOKEN_TTL,
    });
    return { user: toPublicUser(user), token };
  }

  return {
    async register(input) {
      const { email, password, name } = assertRegisterInput(input);
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const user = repository.insert({ email, passwordHash, name });
      if (!user) {
        throw new EmailAlreadyRegisteredError('El email ya está registrado');
      }
      return authResult(user);
    },

    async login(email, password) {
      if (typeof email !== 'string' || typeof password !== 'string') {
        throw new ValidationError('Email y password son obligatorios');
      }
      const user = repository.findByEmail(normalizeEmail(email));
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new InvalidCredentialsError('Email o password incorrectos');
      }
      return authResult(user);
    },
  };
}

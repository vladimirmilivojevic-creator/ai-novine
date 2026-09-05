/**
 * Minimalan logger. Ispisuje jednu JSON liniju po dogadjaju kad radi u CI-ju
 * (GitHub Actions), a citljiv tekst kad radi lokalno u terminalu.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  return (LOG_LEVELS as readonly string[]).includes(raw ?? '') ? (raw as LogLevel) : 'info';
}

const activeLevel = resolveLevel();
const asJson = process.env.CI === 'true' || process.env.LOG_FORMAT === 'json';

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel]) return;

  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (asJson) {
    stream.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level, scope, message, ...fields })}\n`,
    );
    return;
  }

  const tail = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
  stream.write(`${level.toUpperCase().padEnd(5)} [${scope}] ${message}${tail}\n`);
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(childScope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, fields) => emit('debug', scope, message, fields),
    info: (message, fields) => emit('info', scope, message, fields),
    warn: (message, fields) => emit('warn', scope, message, fields),
    error: (message, fields) => emit('error', scope, message, fields),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

export const logger = createLogger('ainovine');

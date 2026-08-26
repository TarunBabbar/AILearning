type Level = 'debug' | 'info' | 'warn' | 'error';

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function emit(level: Level, tag: string, message: string): void {
  const line = `${ts()} [${level.toUpperCase()}] [${tag}] ${message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (tag: string, message: string) => emit('debug', tag, message),
  info: (tag: string, message: string) => emit('info', tag, message),
  warn: (tag: string, message: string) => emit('warn', tag, message),
  error: (tag: string, message: string) => emit('error', tag, message),
};

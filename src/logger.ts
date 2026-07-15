type Level = "debug" | "info" | "warn" | "error";

function stamp(): string {
  return new Date().toISOString();
}

function write(level: Level, message: string, extra?: unknown): void {
  const line = `[${stamp()}] [${level.toUpperCase()}] ${message}`;
  if (extra === undefined) {
    console[level === "debug" ? "log" : level](line);
    return;
  }
  console[level === "debug" ? "log" : level](line, extra);
}

export const logger = {
  debug: (message: string, extra?: unknown) => write("debug", message, extra),
  info: (message: string, extra?: unknown) => write("info", message, extra),
  warn: (message: string, extra?: unknown) => write("warn", message, extra),
  error: (message: string, extra?: unknown) => write("error", message, extra),
};

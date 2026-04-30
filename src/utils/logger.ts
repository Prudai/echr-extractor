import type { Logger } from "../types.js";

class ConsoleLogger implements Logger {
  constructor(private readonly verbose: boolean) {}
  info(msg: string): void {
    if (this.verbose) process.stderr.write(`[echr] ${msg}\n`);
  }
  warn(msg: string): void {
    process.stderr.write(`[echr:warn] ${msg}\n`);
  }
  error(msg: string): void {
    process.stderr.write(`[echr:error] ${msg}\n`);
  }
  debug(msg: string): void {
    if (this.verbose) process.stderr.write(`[echr:debug] ${msg}\n`);
  }
}

const NULL_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * Resolve a Logger from user input.
 *
 * - `null` → silent.
 * - `undefined` → console logger; only emits info/debug when `verbose` is true.
 * - A custom Logger → returned unchanged.
 */
export function resolveLogger(
  logger: Logger | null | undefined,
  verbose: boolean,
): Logger {
  if (logger === null) return NULL_LOGGER;
  if (logger) return logger;
  return new ConsoleLogger(verbose);
}

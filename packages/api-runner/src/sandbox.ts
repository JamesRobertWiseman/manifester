const HIDDEN_GLOBALS = ["process", "global", "fetch", "WebSocket", "EventSource", "navigator"] as const;
const CONSOLE_METHODS = ["log", "info", "warn", "error"] as const;

export function lockDownRuntime(): void {
  for (const method of CONSOLE_METHODS) {
    Object.defineProperty(console, method, {
      configurable: false,
      value: () => undefined,
      writable: false,
    });
  }

  for (const prototype of [
    Object.getPrototypeOf(function () {}),
    Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}),
    Object.getPrototypeOf(async function* () {}),
  ]) {
    Object.defineProperty(prototype, "constructor", {
      configurable: false,
      value: undefined,
      writable: false,
    });
  }

  for (const name of HIDDEN_GLOBALS) {
    Object.defineProperty(globalThis, name, {
      configurable: false,
      value: undefined,
      writable: false,
    });
  }
}

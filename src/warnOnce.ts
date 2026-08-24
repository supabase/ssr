const warnedMessages = new Set<string>();

/**
 * Logs a warning to the console only once per process for each distinct
 * message. Used for configuration warnings that would otherwise fire on
 * every client creation (e.g. once per server request).
 */
export function warnOnce(message: string): void {
  if (warnedMessages.has(message)) {
    return;
  }

  warnedMessages.add(message);
  console.warn(message);
}

/**
 * Clears the set of already-logged messages. Only for use in tests.
 */
export function resetWarnOnceForTesting(): void {
  warnedMessages.clear();
}

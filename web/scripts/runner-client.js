/**
 * Client for the Local Runner API.
 *
 * The interface is designed to work without the runner. When a request fails,
 * the client reports static demo mode instead of throwing, and the editor keeps
 * running with browser-side checks only.
 */

const DEFAULT_POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 2500;

export class RunnerClient {
  #baseUrl;
  #pollIntervalMs;
  #timerId = null;
  #listeners = new Set();
  #status = { connected: false, checkedAt: null, version: null, capabilities: [], error: null };

  constructor({ baseUrl = '', pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = {}) {
    this.#baseUrl = baseUrl;
    this.#pollIntervalMs = pollIntervalMs;
  }

  get status() {
    return this.#status;
  }

  /** Register a status listener and return a function that removes it. */
  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.#status);
    return () => this.#listeners.delete(listener);
  }

  /** Begin polling the runner for liveness. */
  start() {
    void this.refresh();
    this.#timerId = window.setInterval(() => void this.refresh(), this.#pollIntervalMs);
  }

  /** Stop polling. */
  stop() {
    if (this.#timerId !== null) {
      window.clearInterval(this.#timerId);
      this.#timerId = null;
    }
  }

  /** Query the runner once and publish the resulting status. */
  async refresh() {
    try {
      const health = await this.#request('/api/health');
      const version = await this.#request('/api/version');
      this.#publish({
        connected: true,
        checkedAt: new Date(),
        version,
        capabilities: health.capabilities ?? [],
        error: null,
      });
    } catch (error) {
      this.#publish({
        connected: false,
        checkedAt: new Date(),
        version: null,
        capabilities: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return this.#status;
  }

  async #request(path) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.#baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Runner responded with status ${response.status}.`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  #publish(status) {
    this.#status = status;
    for (const listener of this.#listeners) {
      listener(status);
    }
  }
}

/**
 * @license MIT
 * Copyright 2025 VannRR <https://github.com/vannrr>
 *
 * see the LICENSE file for details
 */

/**
 * A reusable native messaging port that auto-reconnects with exponential backoff.
 *
 * @typedef MessageCallback
 * @type {function}
 * @param {unknown} msg  The incoming message from the native host.
 * @returns {void}
 */

/**
 * Manages a persistent `browser.runtime.connectNative` port,
 * handling disconnects and reconnection backoff automatically.
 */
export class NativePort {
  /** @private @type {string} */
  static #NATIVE_NAME = "io.vannrr.omarchy_firefox_theme";

  /** @private @type {browser.runtime.Port|null} */
  #port = null;

  /** @private @type {number} */
  #reconnectDelay = 500;

  /** @private @readonly @type {number} */
  #maxDelay = 30_000;

  /** @private @readonly @type {number} */
  #initialDelay = 500;

  /** @private @type {boolean} */
  #shouldReconnect = false;

  /** @private @type {number|null} */
  #reconnectTimer = null;

  /** @private @type {MessageCallback|null} */
  #onMessageCallback = null;

  /** @private @type {(m: unknown) => void}|null */
  #onMessageHandlerRef = null;

  /** @private @type {() => void}|null */
  #onDisconnectHandlerRef = null;

  /**
   * Starts (or resumes) the native port connection loop.
   *
   * @returns {void}
   */
  start() {
    if (this.#shouldReconnect) return;
    this.#shouldReconnect = true;
    this.#openPort();
  }

  /**
   * Stops the port and cancels any pending reconnect attempt.
   *
   * @returns {void}
   */
  stop() {
    this.#shouldReconnect = false;

    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }

    if (!this.#port) return;

    try {
      if (this.#onMessageHandlerRef) {
        try {
          this.#port.onMessage.removeListener(this.#onMessageHandlerRef);
        } catch {
          /* ignore */
        }
      }
      if (this.#onDisconnectHandlerRef) {
        try {
          this.#port.onDisconnect.removeListener(this.#onDisconnectHandlerRef);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    try {
      this.#port.disconnect();
    } catch {
      /* ignore */
    } finally {
      this.#port = null;
      this.#onMessageHandlerRef = null;
      this.#onDisconnectHandlerRef = null;
    }
  }

  /**
   * Registers a callback for incoming messages.
   *
   * @param {MessageCallback} fn  Called whenever the native host sends a message.
   * @returns {void}
   */
  onMessage(fn) {
    this.#onMessageCallback = fn;
  }

  /**
   * Sends a message to the native host if connected.
   *
   * Note: the native app in your deployment is one-way (native -> extension),
   * but this method is kept for completeness and defensive use.
   *
   * @param {unknown} obj  Any JSON-serializable payload.
   * @returns {void}
   */
  send(obj) {
    if (!this.#port) return;
    try {
      this.#port.postMessage(obj);
    } catch (e) {
      console.error("native postMessage failed", e);
    }
  }

  /**
   * Queues the next reconnect attempt using the current backoff delay with jitter.
   *
   * @returns {void}
   */
  scheduleReconnect() {
    if (!this.#shouldReconnect || this.#reconnectTimer !== null) return;

    const jitterFactor = 0.1; // ±10%
    const base = this.#reconnectDelay;
    const jitter = Math.floor(base * jitterFactor);
    const min = Math.max(0, base - jitter);
    const max = base + jitter;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;

    this.#reconnectTimer = globalThis.setTimeout(() => {
      this.#reconnectTimer = null;
      this.#reconnectDelay = Math.min(this.#reconnectDelay * 2, this.#maxDelay);
      this.#openPort();
    }, delay);
  }

  /**
   * @private
   * Opens or reopens the native port, attaches listeners, and requests the initial payload.
   * Any failure triggers a scheduled reconnect.
   *
   * @returns {void}
   */
  #openPort() {
    if (this.#port) {
      try {
        if (this.#onMessageHandlerRef) {
          try {
            this.#port.onMessage.removeListener(this.#onMessageHandlerRef);
          } catch {
            /* ignore */
          }
        }
        if (this.#onDisconnectHandlerRef) {
          try {
            this.#port.onDisconnect.removeListener(
              this.#onDisconnectHandlerRef,
            );
          } catch {
            /* ignore */
          }
        }
        this.#port.disconnect();
      } catch {
        /* ignore */
      }
      this.#port = null;
      this.#onMessageHandlerRef = null;
      this.#onDisconnectHandlerRef = null;
    }

    try {
      this.#port = browser.runtime.connectNative(NativePort.#NATIVE_NAME);
    } catch (e) {
      console.error("connectNative threw", e);
      this.scheduleReconnect();
      return;
    }

    if (browser.runtime.lastError) {
      console.error("connectNative reported error", browser.runtime.lastError);
      this.#port = null;
      this.scheduleReconnect();
      return;
    }

    this.#onMessageHandlerRef = (m) => {
      try {
        if (this.#onMessageCallback) this.#onMessageCallback(m);
      } catch (e) {
        console.error("onMessage callback error", e);
      }
    };

    this.#onDisconnectHandlerRef = () => {
      const err = browser.runtime.lastError;
      if (err) console.warn("Native port disconnected:", err);

      try {
        if (this.#port) {
          if (this.#onMessageHandlerRef) {
            try {
              this.#port.onMessage.removeListener(this.#onMessageHandlerRef);
            } catch {
              /* ignore */
            }
          }
          if (this.#onDisconnectHandlerRef) {
            try {
              this.#port.onDisconnect.removeListener(
                this.#onDisconnectHandlerRef,
              );
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        this.#port = null;
        this.#onMessageHandlerRef = null;
        this.#onDisconnectHandlerRef = null;
        if (this.#shouldReconnect) this.scheduleReconnect();
      }
    };

    try {
      this.#port.onMessage.addListener(this.#onMessageHandlerRef);
      this.#port.onDisconnect.addListener(this.#onDisconnectHandlerRef);
    } catch (e) {
      console.error("attaching native listeners failed", e);
      try {
        if (this.#port) {
          if (this.#onMessageHandlerRef) {
            try {
              this.#port.onMessage.removeListener(this.#onMessageHandlerRef);
            } catch {
              /* ignore */
            }
          }
          if (this.#onDisconnectHandlerRef) {
            try {
              this.#port.onDisconnect.removeListener(
                this.#onDisconnectHandlerRef,
              );
            } catch {
              /* ignore */
            }
          }
          try {
            this.#port.disconnect();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        this.#port = null;
        this.#onMessageHandlerRef = null;
        this.#onDisconnectHandlerRef = null;
        this.scheduleReconnect();
        return;
      }
    }

    try {
      this.#port.postMessage({});
    } catch (e) {
      console.error("initial postMessage failed — scheduling reconnect", e);
      try {
        if (this.#port) {
          if (this.#onMessageHandlerRef) {
            try {
              this.#port.onMessage.removeListener(this.#onMessageHandlerRef);
            } catch {
              /* ignore */
            }
          }
          if (this.#onDisconnectHandlerRef) {
            try {
              this.#port.onDisconnect.removeListener(
                this.#onDisconnectHandlerRef,
              );
            } catch {
              /* ignore */
            }
          }
          try {
            this.#port.disconnect();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        this.#port = null;
        this.#onMessageHandlerRef = null;
        this.#onDisconnectHandlerRef = null;
        this.scheduleReconnect();
        return;
      }
    }

    this.#reconnectDelay = this.#initialDelay;

    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }
}

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

export class LiveSocket {
  constructor({ token, onMessage, onStatus }) {
    this.token = token;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socket = null;
    this.reconnectTimer = null;
    this.retryMs = 900;
  }

  connect() {
    if (!this.token) return;

    this.socket = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(this.token)}`);
    this.onStatus?.("connecting");

    this.socket.onopen = () => {
      this.retryMs = 900;
      this.onStatus?.("connected");
    };

    this.socket.onmessage = (event) => {
      try {
        this.onMessage?.(JSON.parse(event.data));
      } catch {
        this.onMessage?.({ type: "raw", payload: event.data });
      }
    };

    this.socket.onclose = () => {
      this.onStatus?.("disconnected");
      this.reconnectTimer = window.setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 1.6, 8000);
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  close() {
    window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }
}

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { registerExpress } from "../services/api.js";

export default function AuthExpress({ session, onSession }) {
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const nextSession = await registerExpress(alias.trim());
      localStorage.setItem("workcalist.session", JSON.stringify(nextSession));
      onSession(nextSession);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return (
      <section className="qr-card pop-in">
        <div>
          <p className="eyebrow">Pase express</p>
          <h1>{session.alias}</h1>
        </div>
        <div className="qr-frame">
          <QRCodeSVG value={session.qr_payload || session.user_id} size={180} level="H" />
        </div>
        <p className="muted">Muestra este QR al Staff para activar tu entrada.</p>
        <div className="status-pill">{session.status === "active" ? "Activo en recinto" : "Esperando check-in"}</div>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <div className="brand-block">
        <p className="eyebrow">WorkCalist Live</p>
        <h1>Entra rápido. Vota fuerte.</h1>
        <p className="muted">Alias, QR y listo. Sin teléfono, sin contraseña.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="alias">Alias público</label>
        <input
          id="alias"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder="Ej: BarBro_27"
          minLength={2}
          maxLength={40}
          autoComplete="nickname"
          required
        />
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Generando..." : "Generar QR"}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}

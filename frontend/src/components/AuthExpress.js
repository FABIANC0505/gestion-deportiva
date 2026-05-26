import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { registerExpress, apiRequest } from "../services/api.js";

export default function AuthExpress({ session, onSession, competitors = [] }) {
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Favorite voting states
  const [favoriteId, setFavoriteId] = useState("");
  const [favoriteVoted, setFavoriteVoted] = useState(() => {
    return localStorage.getItem(`workcalist.voted_favorite.${session?.user_id}`) === "true";
  });
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState("");

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

  async function handleVoteFavorite(event) {
    event.preventDefault();
    if (!favoriteId) return;
    setVoteLoading(true);
    setVoteError("");

    try {
      await apiRequest("/api/interaction/favorite", {
        token: session.access_token,
        method: "POST",
        body: { competitor_id: favoriteId },
      });
      localStorage.setItem(`workcalist.voted_favorite.${session.user_id}`, "true");
      setFavoriteVoted(true);
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setVoteLoading(false);
    }
  }

  if (session) {
    const isPublicUser = session.role === "user";

    return (
      <div style={{ display: "grid", gap: "16px" }}>
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

        {/* Favorite Athlete Voting Panel */}
        {isPublicUser && (
          <section className="qr-card pop-in" style={{ padding: "20px" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--orange)" }}>Interactúa</p>
              <h2>Elige a tu Atleta Favorito</h2>
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                ¡Apoya a tu atleta preferido de la competencia! Solo puedes votar una vez.
              </p>
            </div>

            {favoriteVoted ? (
              <div className="status-pill" style={{ background: "rgba(67, 255, 158, 0.1)", color: "var(--green)", border: "1px solid var(--green)" }}>
                ¡Voto registrado! Gracias por participar 🗳️
              </div>
            ) : (
              <form onSubmit={handleVoteFavorite} style={{ width: "100%", display: "grid", gap: "10px", marginTop: "10px" }}>
                {competitors.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.9rem" }}>Esperando registro de competidores...</p>
                ) : (
                  <>
                    <select
                      value={favoriteId}
                      onChange={(e) => setFavoriteId(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#0a0c10",
                        color: "var(--text)",
                        minHeight: "50px",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        padding: "0 12px"
                      }}
                      required
                    >
                      <option value="">-- Selecciona tu Favorito --</option>
                      {competitors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button className="primary-btn" type="submit" disabled={voteLoading || !favoriteId}>
                      {voteLoading ? "Enviando voto..." : "Votar ahora"}
                    </button>
                  </>
                )}
                {voteError && <p className="error-text" style={{ fontSize: "0.85rem" }}>{voteError}</p>}
              </form>
            )}
          </section>
        )}
      </div>
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

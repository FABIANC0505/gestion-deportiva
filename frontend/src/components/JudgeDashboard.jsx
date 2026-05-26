import { useState, useMemo } from "react";
import { apiRequest } from "../services/api.js";

const CRITERIA = [
  { key: "coordination", label: "Coordinación", icon: "🤸‍♂️" },
  { key: "strength", label: "Fuerza", icon: "💪" },
  { key: "endurance", label: "Resistencia", icon: "🫁" },
  { key: "flexibility", label: "Flexibilidad", icon: "🤸‍♂️" },
];

export default function JudgeDashboard({ session, activeAthlete, onLogout }) {
  const [scores, setScores] = useState({
    coordination: 7.0,
    strength: 7.0,
    endurance: 7.0,
    flexibility: 7.0,
  });
  const [publicScore, setPublicScore] = useState(7.0);
  const [modality, setModality] = useState("dynamic");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const athleteName = activeAthlete?.name || "Atleta en escena";
  const athleteId = activeAthlete?.id || null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!athleteId) {
      setError("No hay ningún atleta activo asignado por el Staff");
      return;
    }

    setError("");
    setResult(null);
    setSubmitting(true);

    try {
      const data = await apiRequest("/api/scoring/calculate", {
        token: session.access_token,
        method: "POST",
        body: {
          competitor_id: athleteId,
          modality: activeAthlete?.modality || modality,
          judge_scores: [scores],
          public_score: publicScore,
        },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-shell pop-in">
      <div className="role-heading">
        <p className="eyebrow">Panel de Juez</p>
        <h1>Evaluación Técnica</h1>
        <p className="muted">Califica al atleta que se encuentra actualmente en escena.</p>
        
        <button 
          style={{ marginTop: "16px", background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} 
          className="primary-btn" 
          onClick={onLogout}
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="mobile-flow">
        {/* Active Athlete Info */}
        <div className="live-card">
          <div className="live-header">
            <div>
              <p className="eyebrow">Atleta Activo</p>
              <h2>{athleteName}</h2>
              <p className="muted" style={{ fontSize: "0.9rem", marginTop: "4px" }}>
                Modalidad: <strong>{activeAthlete?.modality === "static" ? "Estáticos" : "Dinámicos"}</strong>
              </p>
            </div>
            {!athleteId && (
              <span style={{ color: "var(--orange)", fontWeight: "bold" }}>⚠️ Esperando asignación</span>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "20px" }}>
            <div className="slider-stack">
              <h3>Criterios del Juez</h3>
              {CRITERIA.map((criterion) => (
                <label className="score-slider" key={criterion.key}>
                  <span>
                    <b>{criterion.icon}</b>
                    {criterion.label}
                  </span>
                  <output>{scores[criterion.key]}</output>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={scores[criterion.key]}
                    onChange={(event) =>
                      setScores((current) => ({ ...current, [criterion.key]: Number(event.target.value) }))
                    }
                    style={{ "--fill": `${((scores[criterion.key] - 1) / 9) * 100}%` }}
                  />
                </label>
              ))}
            </div>

            <div className="slider-stack" style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
              <h3>Componente del Público</h3>
              <label className="score-slider">
                <span>
                  <b>🔥</b>
                  Calificación del Público / Hype
                </span>
                <output>{publicScore}</output>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={publicScore}
                  onChange={(event) => setPublicScore(Number(event.target.value))}
                  style={{ "--fill": `${((publicScore - 1) / 9) * 100}%` }}
                />
              </label>
            </div>

            <button 
              className="primary-btn" 
              type="submit" 
              disabled={submitting || !athleteId}
              style={{ marginTop: "10px" }}
            >
              {submitting ? "Enviando calificación..." : "Enviar Calificación Oficial"}
            </button>
          </form>

          {error && <p className="error-text" style={{ marginTop: "16px" }}>{error}</p>}

          {result && (
            <div className="role-result pop-in" style={{ marginTop: "20px" }}>
              <span>Calificación Registrada</span>
              <strong>Atleta: {athleteName}</strong>
              <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                <div>Componente Jueces (80%): <code>{result.judges_component}</code></div>
                <div>Componente Público (20%): <code>{result.public_component}</code></div>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--neon)", marginTop: "6px" }}>
                  PUNTAJE FINAL: {result.final_score}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

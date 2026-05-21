import { useMemo, useState } from "react";

const CRITERIA = [
  { key: "coordination", label: "Coordinación", icon: "🤸‍♂️" },
  { key: "strength", label: "Fuerza", icon: "💪" },
  { key: "endurance", label: "Resistencia", icon: "🫁" },
  { key: "flexibility", label: "Flexibilidad", icon: "🤸‍♂️" },
];

export default function LiveVoting({ athlete, modality, elapsedSeconds, disabled }) {
  const [scores, setScores] = useState({
    coordination: 7,
    strength: 7,
    endurance: 7,
    flexibility: 7,
  });

  const average = useMemo(() => {
    const total = Object.values(scores).reduce((sum, value) => sum + Number(value), 0);
    return (total / CRITERIA.length).toFixed(1);
  }, [scores]);

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <section className="live-card">
      <div className="live-header">
        <div>
          <p className="eyebrow">{modality === "static" ? "Estáticos" : "Dinámicos"}</p>
          <h2>{athlete?.name || "Atleta en escena"}</h2>
        </div>
        <div className="timer" aria-label="Cronómetro">
          <span>⏱️</span>
          {minutes}:{seconds}
        </div>
      </div>

      <div className="score-badge">
        <span>Promedio público</span>
        <strong>{average}</strong>
      </div>

      <div className="slider-stack">
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
              value={scores[criterion.key]}
              disabled={disabled}
              onChange={(event) =>
                setScores((current) => ({ ...current, [criterion.key]: Number(event.target.value) }))
              }
              style={{ "--fill": `${((scores[criterion.key] - 1) / 9) * 100}%` }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

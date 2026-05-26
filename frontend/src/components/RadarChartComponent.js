const AXES = ["Coordinación", "Fuerza", "Resistencia", "Flexibilidad"];

function pointFor(index, value, radius, center) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / AXES.length;
  const scaled = (value / 10) * radius;
  return {
    x: center + Math.cos(angle) * scaled,
    y: center + Math.sin(angle) * scaled,
  };
}

function polygon(scores, radius, center) {
  return AXES.map((axis, index) => pointFor(index, scores[index] || 0, radius, center))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export default function RadarChartComponent({ competitors = [], favorites = [], globalHype = 0 }) {
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const rings = [2, 4, 6, 8, 10];

  const isHypeBurst = globalHype >= 90;

  return (
    <section className="event-screen pop-in">
      <div className="event-title">
        <p className="eyebrow">Dashboard del evento</p>
        <h1>🏆 Radar técnico en vivo</h1>
      </div>

      {/* Global Live Hype Thermometer */}
      <div 
        style={{ 
          marginTop: "16px", 
          background: "var(--panel)", 
          border: isHypeBurst ? "2px solid var(--neon)" : "1px solid var(--line)", 
          borderRadius: "8px", 
          padding: "16px",
          boxShadow: isHypeBurst ? "0 0 20px rgba(248, 255, 46, 0.25)" : "none",
          transition: "all 0.3s ease",
          animation: isHypeBurst ? "pulse 1s infinite alternate" : "none"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: isHypeBurst ? "var(--neon)" : "var(--orange)" }}>
            {isHypeBurst ? "🔥 ¡HYPE BURST ACTIVO! ⚡️" : "🔥 Medidor de Hype del Público"}
          </strong>
          <span>Hype: {globalHype}%</span>
        </div>
        <div style={{ height: "14px", width: "100%", background: "#0a0c10", borderRadius: "7px", marginTop: "10px", overflow: "hidden", border: "1px solid var(--line)" }}>
          <div 
            style={{ 
              height: "100%", 
              width: `${globalHype}%`, 
              background: isHypeBurst ? "linear-gradient(90deg, var(--orange), var(--neon))" : "var(--orange)", 
              boxShadow: "0 0 10px rgba(255, 122, 26, 0.5)",
              transition: "width 0.15s ease" 
            }} 
          />
        </div>
      </div>

      <div className="radar-layout">
        <svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de puntajes">
          {rings.map((ring) => (
            <polygon
              className="radar-ring"
              key={ring}
              points={polygon([ring, ring, ring, ring], radius, center)}
            />
          ))}

          {AXES.map((axis, index) => {
            const end = pointFor(index, 10, radius, center);
            const label = pointFor(index, 11.7, radius, center);
            return (
              <g key={axis}>
                <line className="radar-axis" x1={center} y1={center} x2={end.x} y2={end.y} />
                <text className="radar-label" x={label.x} y={label.y} textAnchor="middle">
                  {axis}
                </text>
              </g>
            );
          })}

          {competitors.map((competitor, index) => (
            <polygon
              className={`radar-area radar-area-${index % 3}`}
              key={competitor.id || competitor.name}
              points={polygon(competitor.scores, radius, center)}
            />
          ))}
        </svg>

        <div style={{ display: "grid", gap: "20px" }}>
          {/* Official Leaderboard */}
          <div className="ranking-list">
            <h3>Leaderboard Oficial</h3>
            {competitors.map((competitor, index) => (
              <div className="ranking-row" key={competitor.id || competitor.name}>
                <span>{index + 1}</span>
                <strong>{competitor.name}</strong>
                <em>{competitor.total?.toFixed?.(1) || competitor.total || "0.0"}</em>
              </div>
            ))}
            {competitors.length === 0 && (
              <p className="muted">Sin puntajes oficiales registrados.</p>
            )}
          </div>

          {/* Public Favorites Tally */}
          <div className="ranking-list" style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
            <h3>🗳️ Favorito del Público</h3>
            {favorites.map((fav, index) => (
              <div 
                key={fav.id}
                style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  background: "var(--panel-soft)", 
                  padding: "10px 14px", 
                  borderRadius: "8px",
                  border: "1px solid var(--line)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{index + 1}. {fav.name}</strong>
                  <span style={{ color: "var(--neon)", fontWeight: "bold" }}>{fav.percentage}% ({fav.votes} votos)</span>
                </div>
                <div style={{ height: "4px", width: "100%", background: "#0a0c10", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fav.percentage}%`, background: "var(--neon)", transition: "width 0.3s ease" }} />
                </div>
              </div>
            ))}
            {favorites.length === 0 && (
              <p className="muted">Sin votos del público todavía.</p>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}

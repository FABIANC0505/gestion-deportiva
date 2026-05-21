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

export default function RadarChartComponent({ competitors = [] }) {
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const rings = [2, 4, 6, 8, 10];

  return (
    <section className="event-screen">
      <div className="event-title">
        <p className="eyebrow">Dashboard del evento</p>
        <h1>🏆 Radar técnico en vivo</h1>
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

        <div className="ranking-list">
          {competitors.map((competitor, index) => (
            <div className="ranking-row" key={competitor.id || competitor.name}>
              <span>{index + 1}</span>
              <strong>{competitor.name}</strong>
              <em>{competitor.total?.toFixed?.(1) || competitor.total || "0.0"}</em>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

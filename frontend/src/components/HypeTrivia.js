import { useState } from "react";

import { sendHype, submitTriviaAnswer } from "../services/api.js";

export default function HypeTrivia({ token, eventId, trivia, active }) {
  const [hypeBurst, setHypeBurst] = useState(0);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  async function handleHype() {
    setError("");
    setHypeBurst((value) => value + 1);
    try {
      await sendHype(token, eventId, 5);
    } catch (err) {
      setError(err.message);
    }
  }

  async function answer(answerId) {
    setSelected(answerId);
    setError("");
    try {
      await submitTriviaAnswer(token, trivia.id, answerId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="interaction-grid">
      <div className={`trivia-panel ${trivia ? "slide-in" : ""}`}>
        <p className="eyebrow">Trivia en vivo</p>
        {trivia ? (
          <>
            <h2>{trivia.question}</h2>
            <div className="answer-grid">
              {trivia.options.map((option) => (
                <button
                  className={selected === option.id ? "answer selected" : "answer"}
                  key={option.id}
                  disabled={!active}
                  onClick={() => answer(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Espera la próxima pregunta del evento.</p>
        )}
      </div>

      <div className="hype-panel">
        <button className="hype-btn" disabled={!active} onClick={handleHype}>
          ¡DALE HYPE! 🔥
        </button>
        <div className="hype-meter" style={{ "--pulse": hypeBurst % 2 }} />
        {error ? <p className="error-text">{error}</p> : <p className="muted">Disponible solo con check-in activo.</p>}
      </div>
    </section>
  );
}

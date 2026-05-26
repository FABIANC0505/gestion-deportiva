import { useState, useEffect } from "react";

import { sendHype, apiRequest } from "../services/api.js";

export default function HypeTrivia({ token, eventId, trivia, poll, active }) {
  const [hypeBurst, setHypeBurst] = useState(0);
  const [selectedTrivia, setSelectedTrivia] = useState("");
  const [selectedPoll, setSelectedPoll] = useState("");
  const [error, setError] = useState("");

  const [pollVoted, setPollVoted] = useState(false);

  // Check if voted in the current poll when poll changes
  useEffect(() => {
    if (poll) {
      const voted = localStorage.getItem(`workcalist.voted_poll.${poll.question}`) === "true";
      setPollVoted(voted);
      setSelectedPoll("");
    } else {
      setPollVoted(false);
    }
  }, [poll]);

  async function handleHype() {
    setError("");
    setHypeBurst((value) => value + 1);
    try {
      await sendHype(token, eventId, 5);
    } catch (err) {
      setError(err.message);
    }
  }

  async function answerTrivia(answerId) {
    setSelectedTrivia(answerId);
    setError("");
    try {
      await apiRequest("/api/interaction/trivias/answer", {
        token,
        method: "POST",
        body: { trivia_id: trivia.id, answer_id: answerId },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function votePoll(optionId) {
    setSelectedPoll(optionId);
    setError("");
    try {
      await apiRequest("/api/interaction/polls/vote", {
        token,
        method: "POST",
        body: { option_id: optionId },
      });
      localStorage.setItem(`workcalist.voted_poll.${poll.question}`, "true");
      setPollVoted(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="interaction-grid">
      {/* Trivia Panel */}
      <div className={`trivia-panel ${trivia ? "slide-in" : ""}`}>
        <p className="eyebrow">Trivia en vivo</p>
        {trivia ? (
          <>
            <h2>{trivia.question}</h2>
            <div className="answer-grid">
              {trivia.options.map((option) => (
                <button
                  className={selectedTrivia === option.id ? "answer selected" : "answer"}
                  key={option.id}
                  disabled={!active}
                  onClick={() => answerTrivia(option.id)}
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

      {/* Custom Poll Panel */}
      {poll && (
        <div className="trivia-panel slide-in" style={{ borderColor: "var(--orange)" }}>
          <p className="eyebrow" style={{ color: "var(--orange)" }}>Encuesta del Público</p>
          <h2>{poll.question}</h2>
          
          {pollVoted ? (
            <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
              {poll.options.map((option) => {
                const count = poll.tally?.[option.id] || 0;
                const total = poll.total || 0;
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return (
                  <div key={option.id} style={{ display: "flex", flexDirection: "column", background: "var(--panel-soft)", padding: "8px 12px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                      <span>{option.label}</span>
                      <strong>{count} votos ({pct}%)</strong>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "#222", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)", transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="answer-grid">
              {poll.options.map((option) => (
                <button
                  className={selectedPoll === option.id ? "answer selected" : "answer"}
                  key={option.id}
                  disabled={!active}
                  onClick={() => votePoll(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hype Panel */}
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

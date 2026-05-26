import { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";

export default function StaffDashboard({ session, onLogout, socketMessage }) {
  // Competitor states
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState("");
  const [modality, setModality] = useState("dynamic");

  // Attendance states
  const [scanUserId, setScanUserId] = useState("");
  const [scanReason, setScanReason] = useState("");
  const [attendanceMsg, setAttendanceMsg] = useState("");
  const [attendanceError, setAttendanceError] = useState("");

  // Trivia states
  const [triviaId, setTriviaId] = useState("trivia-1");
  const [triviaQuestion, setTriviaQuestion] = useState("");
  const [triviaOptA, setTriviaOptA] = useState("");
  const [triviaOptB, setTriviaOptB] = useState("");
  const [triviaOptC, setTriviaOptC] = useState("");
  const [activeTrivia, setActiveTrivia] = useState(null);
  const [answersTally, setAnswersTally] = useState({});

  // Poll states (Encuestas del Staff)
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptA, setPollOptA] = useState("");
  const [pollOptB, setPollOptB] = useState("");
  const [pollOptC, setPollOptC] = useState("");
  const [activePoll, setActivePoll] = useState(null);
  const [pollTally, setPollTally] = useState({});
  const [pollTotal, setPollTotal] = useState(0);

  // Loading/Errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch competitors (operational users with role 'competitor')
  async function fetchCompetitors() {
    try {
      const data = await apiRequest("/api/auth/users", { token: session.access_token });
      const filtered = data.filter((u) => u.role === "competitor");
      setCompetitors(filtered);
      if (filtered.length > 0) {
        setSelectedCompetitorId(filtered[0].id);
      }
    } catch (err) {
      console.error("Error fetching competitors:", err);
    }
  }

  useEffect(() => {
    fetchCompetitors();
  }, []);

  // Listen to live trivia & poll votes over WS
  useEffect(() => {
    if (!socketMessage) return;
    if (socketMessage.type === "trivia-answer") {
      setAnswersTally((tally) => {
        const key = socketMessage.answer_id;
        return { ...tally, [key]: (tally[key] || 0) + 1 };
      });
    }
    if (socketMessage.type === "poll-vote-update") {
      setPollTally(socketMessage.tally);
      setPollTotal(socketMessage.total);
    }
    if (socketMessage.type === "poll-launched") {
      setActivePoll(socketMessage.poll);
      setPollTally({});
      setPollTotal(0);
    }
  }, [socketMessage]);

  async function handleSetCompetitor(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedCompetitorId) return;

    const comp = competitors.find((c) => c.id === selectedCompetitorId);
    const name = comp ? comp.alias : "Competidor";

    try {
      await apiRequest("/api/interaction/competition/state", {
        token: session.access_token,
        method: "POST",
        body: {
          competitor_id: selectedCompetitorId,
          competitor_name: name,
          modality: modality,
        },
      });
      setSuccess(`Atleta "${name}" establecido en escena (${modality === "static" ? "Estáticos" : "Dinámicos"})`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCheckIn(event) {
    event.preventDefault();
    setAttendanceMsg("");
    setAttendanceError("");
    if (!scanUserId.trim()) return;

    try {
      const res = await apiRequest("/api/attendance/check-in", {
        token: session.access_token,
        method: "POST",
        body: { user_id: scanUserId.trim(), reason: scanReason.trim() || null },
      });
      setAttendanceMsg(`Check-in exitoso para: ${res.alias}. Aforo activo: ${res.active_users}`);
      setScanUserId("");
      setScanReason("");
    } catch (err) {
      setAttendanceError(err.message);
    }
  }

  async function handleCheckOut(event) {
    event.preventDefault();
    setAttendanceMsg("");
    setAttendanceError("");
    if (!scanUserId.trim()) return;

    try {
      const res = await apiRequest("/api/attendance/check-out", {
        token: session.access_token,
        method: "POST",
        body: { user_id: scanUserId.trim(), reason: scanReason.trim() || null },
      });
      setAttendanceMsg(`Check-out exitoso para: ${res.alias}. Aforo activo: ${res.active_users}`);
      setScanUserId("");
      setScanReason("");
    } catch (err) {
      setAttendanceError(err.message);
    }
  }

  async function handleLaunchTrivia(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!triviaQuestion || !triviaOptA || !triviaOptB) {
      setError("La trivia requiere pregunta y al menos dos opciones");
      return;
    }

    const options = [
      { id: "A", label: triviaOptA },
      { id: "B", label: triviaOptB },
    ];
    if (triviaOptC) {
      options.push({ id: "C", label: triviaOptC });
    }

    const triviaData = {
      trivia_id: triviaId,
      question: triviaQuestion,
      options: options,
    };

    try {
      await apiRequest("/api/interaction/trivias/launch", {
        token: session.access_token,
        method: "POST",
        body: triviaData,
      });
      setActiveTrivia(triviaData);
      setAnswersTally({});
      setSuccess("Trivia lanzada en vivo al público");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCloseTrivia() {
    if (!activeTrivia) return;
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/api/interaction/trivias/close?trivia_id=${activeTrivia.id}`, {
        token: session.access_token,
        method: "POST",
      });
      setSuccess(`Trivia "${activeTrivia.question}" cerrada`);
      setActiveTrivia(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLaunchPoll(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!pollQuestion || !pollOptA || !pollOptB) {
      setError("La encuesta requiere una pregunta y al menos dos opciones");
      return;
    }

    const options = [
      { id: "A", label: pollOptA },
      { id: "B", label: pollOptB },
    ];
    if (pollOptC) {
      options.push({ id: "C", label: pollOptC });
    }

    try {
      await apiRequest("/api/interaction/polls/launch", {
        token: session.access_token,
        method: "POST",
        body: {
          question: pollQuestion,
          options: options,
        },
      });
      setPollQuestion("");
      setPollOptA("");
      setPollOptB("");
      setPollOptC("");
      setSuccess("Encuesta lanzada al público");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClosePoll() {
    setError("");
    setSuccess("");
    try {
      await apiRequest("/api/interaction/polls/close", {
        token: session.access_token,
        method: "POST",
      });
      setSuccess("Encuesta cerrada");
      setActivePoll(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="role-shell pop-in">
      <div className="role-heading">
        <p className="eyebrow">Panel de Staff</p>
        <h1>Control de Operaciones</h1>
        <p className="muted">Controla asistencia por QR, asigna el atleta activo, lanza trivias y encuestas en vivo.</p>

        <button 
          style={{ marginTop: "16px", background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} 
          className="primary-btn" 
          onClick={onLogout}
        >
          Cerrar Sesión
        </button>
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        
        {/* Active Competitor Controller */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Asignar Competidor en Escena</h2>
          <form className="auth-form" onSubmit={handleSetCompetitor}>
            <label htmlFor="competitor-select">Selecciona el atleta</label>
            {competitors.length === 0 ? (
              <p className="muted">No hay competidores registrados. Ve al panel de Admin.</p>
            ) : (
              <select
                id="competitor-select"
                value={selectedCompetitorId}
                onChange={(e) => setSelectedCompetitorId(e.target.value)}
                style={{
                  background: "#0a0c10",
                  color: "var(--text)",
                  minHeight: "56px",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "0 16px"
                }}
              >
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.alias}
                  </option>
                ))}
              </select>
            )}

            <label>Modalidad de competencia</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="primary-btn"
                style={{
                  flex: 1,
                  background: modality === "dynamic" ? "var(--neon)" : "var(--panel-soft)",
                  color: modality === "dynamic" ? "#111" : "var(--text)",
                  borderColor: modality === "dynamic" ? "var(--neon)" : "var(--line)",
                }}
                onClick={() => setModality("dynamic")}
              >
                Dinámicos
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{
                  flex: 1,
                  background: modality === "static" ? "var(--neon)" : "var(--panel-soft)",
                  color: modality === "static" ? "#111" : "var(--text)",
                  borderColor: modality === "static" ? "var(--neon)" : "var(--line)",
                }}
                onClick={() => setModality("static")}
              >
                Estáticos
              </button>
            </div>

            <button className="primary-btn" type="submit" disabled={competitors.length === 0}>
              Establecer Atleta Activo
            </button>
          </form>
          {success && <p style={{ color: "var(--green)", marginTop: "10px" }}>{success}</p>}
          {error && <p className="error-text" style={{ marginTop: "10px" }}>{error}</p>}
        </div>

        {/* Check-In / Check-Out QR Attendance Flow */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Registro de Asistencia / Escaneo QR</h2>
          <form className="auth-form">
            <label htmlFor="user-id-scan">ID de Usuario (Código QR)</label>
            <input
              id="user-id-scan"
              value={scanUserId}
              onChange={(e) => setScanUserId(e.target.value)}
              placeholder="Pega o escanea el ID de usuario (UUID)"
              required
            />

            <label htmlFor="reason-scan">Nota / Razón (Opcional)</label>
            <input
              id="reason-scan"
              value={scanReason}
              onChange={(e) => setScanReason(e.target.value)}
              placeholder="Ej: LLegada puntual"
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button className="primary-btn" type="button" onClick={handleCheckIn} style={{ flex: 1, background: "var(--green)", color: "#111" }}>
                Check-In (Ingresar)
              </button>
              <button className="primary-btn" type="button" onClick={handleCheckOut} style={{ flex: 1, background: "var(--orange)", color: "#111" }}>
                Check-Out (Salida)
              </button>
            </div>
          </form>
          {attendanceMsg && <p style={{ color: "var(--green)", marginTop: "10px" }}>{attendanceMsg}</p>}
          {attendanceError && <p className="error-text" style={{ marginTop: "10px" }}>{attendanceError}</p>}
        </div>

        {/* Live Trivia Dashboard */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Administrar Trivia en Vivo</h2>
          {!activeTrivia ? (
            <form className="auth-form" onSubmit={handleLaunchTrivia}>
              <label>ID de Trivia</label>
              <input value={triviaId} onChange={(e) => setTriviaId(e.target.value)} required />

              <label>Pregunta</label>
              <input value={triviaQuestion} onChange={(e) => setTriviaQuestion(e.target.value)} placeholder="¿Cuál es la pregunta?" required />

              <label>Opción A (Requerido)</label>
              <input value={triviaOptA} onChange={(e) => setTriviaOptA(e.target.value)} placeholder="Ej: 5 segundos" required />

              <label>Opción B (Requerido)</label>
              <input value={triviaOptB} onChange={(e) => setTriviaOptB(e.target.value)} placeholder="Ej: 3 segundos" required />

              <label>Opción C (Opcional)</label>
              <input value={triviaOptC} onChange={(e) => setTriviaOptC(e.target.value)} placeholder="Ej: No hay límite" />

              <button className="primary-btn" type="submit">
                Lanzar Trivia
              </button>
            </form>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ padding: "12px", border: "1px solid var(--neon)", borderRadius: "8px", background: "rgba(248, 255, 46, 0.05)" }}>
                <span className="eyebrow">Trivias Activa</span>
                <h3>{activeTrivia.question}</h3>
                <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                  {activeTrivia.options.map((opt) => (
                    <div key={opt.id} style={{ display: "flex", justifyContent: "space-between", background: "var(--panel-soft)", padding: "8px 12px", borderRadius: "4px" }}>
                      <span>({opt.id}) {opt.label}</span>
                      <strong>Respuestas: {answersTally[opt.id] || 0}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <button className="primary-btn" style={{ background: "var(--danger)", color: "#fff" }} onClick={handleCloseTrivia}>
                Cerrar Trivia
              </button>
            </div>
          )}
        </div>

        {/* Custom Poll / Survey Creator */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Generar Encuesta de Opinión (Staff)</h2>
          {!activePoll ? (
            <form className="auth-form" onSubmit={handleLaunchPoll}>
              <label>Pregunta de la Encuesta</label>
              <input 
                value={pollQuestion} 
                onChange={(e) => setPollQuestion(e.target.value)} 
                placeholder="Ej: ¿Qué te pareció el combo del atleta?" 
                required 
              />

              <label>Opción A (Requerido)</label>
              <input value={pollOptA} onChange={(e) => setPollOptA(e.target.value)} placeholder="Ej: ¡Increíble! 🔥" required />

              <label>Opción B (Requerido)</label>
              <input value={pollOptB} onChange={(e) => setPollOptB(e.target.value)} placeholder="Ej: Normal 👍" required />

              <label>Opción C (Opcional)</label>
              <input value={pollOptC} onChange={(e) => setPollOptC(e.target.value)} placeholder="Ej: Pudo ser mejor" />

              <button className="primary-btn" type="submit">
                Lanzar Encuesta en Vivo
              </button>
            </form>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ padding: "12px", border: "1px solid var(--orange)", borderRadius: "8px", background: "rgba(255, 122, 26, 0.05)" }}>
                <span className="eyebrow" style={{ color: "var(--orange)" }}>Encuesta Activa</span>
                <h3>{activePoll.question}</h3>
                <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                  {activePoll.options.map((opt) => {
                    const count = pollTally[opt.id] || 0;
                    const pct = pollTotal > 0 ? ((count / pollTotal) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={opt.id} style={{ display: "flex", flexDirection: "column", background: "var(--panel-soft)", padding: "8px 12px", borderRadius: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>({opt.id}) {opt.label}</span>
                          <strong>{count} votos ({pct}%)</strong>
                        </div>
                        <div style={{ height: "4px", width: "100%", background: "#222", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)", transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "10px", fontSize: "0.9rem", color: "var(--muted)" }}>
                  Votos Totales: {pollTotal}
                </div>
              </div>
              <button className="primary-btn" style={{ background: "var(--danger)", color: "#fff" }} onClick={handleClosePoll}>
                Cerrar Encuesta
              </button>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

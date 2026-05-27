import { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";

const CRITERIA = [
  { key: "coordination", label: "Coordinación", icon: "🤸‍♂️" },
  { key: "strength", label: "Fuerza", icon: "💪" },
  { key: "endurance", label: "Resistencia", icon: "🫁" },
  { key: "flexibility", label: "Flexibilidad", icon: "🤸‍♂️" },
];

export default function AdminPanel({ session, onLogout, socketMessage, activeAthlete }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // CRUD User Form states
  const [newAlias, setNewAlias] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const [editingUser, setEditingUser] = useState(null);
  const [editAlias, setEditAlias] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Active Competitor state
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState("");
  const [modality, setModality] = useState("dynamic");

  // Attendance scanner state
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

  // Poll states
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptA, setPollOptA] = useState("");
  const [pollOptB, setPollOptB] = useState("");
  const [pollOptC, setPollOptC] = useState("");

  // Judge scoring state
  const [judgeScores, setJudgeScores] = useState({
    coordination: 7.0,
    strength: 7.0,
    endurance: 7.0,
    flexibility: 7.0,
  });
  const [judgePublicScore, setJudgePublicScore] = useState(7.0);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/auth/users", { token: session.access_token });
      setUsers(data);
      
      const filteredCompetitors = data.filter((u) => u.role === "competitor");
      setCompetitors(filteredCompetitors);
      if (filteredCompetitors.length > 0 && !selectedCompetitorId) {
        setSelectedCompetitorId(filteredCompetitors[0].id);
      }
    } catch (err) {
      setError("No se pudieron cargar los usuarios: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const data = await apiRequest("/api/auth/admin/stats", { token: session.access_token });
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchStats();

    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket events for trivia tallies and custom poll updates
  useEffect(() => {
    if (!socketMessage) return;
    if (socketMessage.type === "trivia-answer") {
      setAnswersTally((tally) => {
        const key = socketMessage.answer_id;
        return { ...tally, [key]: (tally[key] || 0) + 1 };
      });
    }
    if (socketMessage.type === "trivia-launched") {
      setActiveTrivia(socketMessage.trivia);
      setAnswersTally({});
    }
  }, [socketMessage]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!newAlias.trim() || !newUsername.trim() || !newPassword.trim()) {
      setError("Todos los campos requeridos deben estar completos");
      return;
    }

    try {
      await apiRequest("/api/auth/register-role", {
        token: session.access_token,
        method: "POST",
        body: { 
          alias: newAlias.trim(), 
          role: newRole,
          username: newUsername.trim(),
          password: newPassword,
          weight: newRole === "competitor" && newWeight ? parseFloat(newWeight) : null,
          category: newRole === "competitor" && newCategory ? newCategory.trim() : null
        },
      });
      setNewAlias("");
      setNewUsername("");
      setNewPassword("");
      setNewWeight("");
      setNewCategory("");
      setSuccess("Usuario registrado exitosamente");
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(userId) {
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/api/auth/users/${userId}`, {
        token: session.access_token,
        method: "DELETE",
      });
      setSuccess("Usuario eliminado");
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(user) {
    setEditingUser(user);
    setEditAlias(user.alias);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditUsername(user.username || "");
    setEditPassword("");
    setEditWeight(user.weight !== undefined && user.weight !== null ? user.weight.toString() : "");
    setEditCategory(user.category || "");
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const body = { 
        alias: editAlias.trim(), 
        role: editRole, 
        status: editStatus,
        username: editUsername.trim(),
        weight: editRole === "competitor" && editWeight ? parseFloat(editWeight) : null,
        category: editRole === "competitor" && editCategory ? editCategory.trim() : null
      };
      if (editPassword) {
        body.password = editPassword;
      }
      await apiRequest(`/api/auth/users/${editingUser.id}`, {
        token: session.access_token,
        method: "PATCH",
        body: body,
      });
      setEditingUser(null);
      setSuccess("Usuario actualizado");
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  }

  // --- ATTENDANCE CONTROL ---
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
      fetchStats();
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
      fetchStats();
    } catch (err) {
      setAttendanceError(err.message);
    }
  }

  // --- COMPETITOR FLUX CONTROL ---
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

  // --- TRIVIA CONTROL ---
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
      setSuccess("Trivia lanzada en vivo");
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
      setSuccess("Trivia cerrada");
      setActiveTrivia(null);
    } catch (err) {
      setError(err.message);
    }
  }

  // --- CUSTOM POLLS CONTROL ---
  async function handleLaunchPoll(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!pollQuestion || !pollOptA || !pollOptB) {
      setError("La encuesta requiere pregunta y al menos dos opciones");
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
        body: { question: pollQuestion, options },
      });
      setPollQuestion("");
      setPollOptA("");
      setPollOptB("");
      setPollOptC("");
      setSuccess("Encuesta lanzada al público");
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeletePoll() {
    if (!window.confirm("¿Estás seguro de cerrar y eliminar la encuesta activa?")) return;
    setError("");
    setSuccess("");
    try {
      await apiRequest("/api/interaction/polls/close", {
        token: session.access_token,
        method: "POST"
      });
      setSuccess("Encuesta activa eliminada");
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  }

  // --- JUDGE EVALUATION FLOW ---
  async function handleVoteScoring(event) {
    event.preventDefault();
    if (!activeAthlete?.id) {
      setError("No hay ningún atleta activo asignado en escena");
      return;
    }
    setError("");
    setScoreResult(null);
    setScoreSubmitting(true);

    try {
      const data = await apiRequest("/api/scoring/calculate", {
        token: session.access_token,
        method: "POST",
        body: {
          competitor_id: activeAthlete.id,
          modality: activeAthlete.modality,
          judge_scores: [judgeScores],
          public_score: judgePublicScore,
        },
      });
      setScoreResult(data);
      setSuccess("Puntaje oficial enviado y publicado");
    } catch (err) {
      setError(err.message);
    } finally {
      setScoreSubmitting(false);
    }
  }

  return (
    <section className="role-shell pop-in">
      <div className="role-heading">
        <p className="eyebrow">Panel de Super-Administración</p>
        <h1>Control Maestro del Evento</h1>
        <p className="muted">Administra roles, competidores, asistencia QR, trivias, encuestas y calificaciones técnicas.</p>

        <button 
          style={{ marginTop: "16px", background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} 
          className="primary-btn" 
          onClick={onLogout}
        >
          Cerrar Sesión
        </button>
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        
        {/* 1. Event Live Statistics Dashboard */}
        {stats && (
          <div 
            style={{ 
              background: "var(--panel)", 
              borderRadius: "8px", 
              border: "1px solid var(--line)", 
              padding: "20px", 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
              gap: "16px" 
            }}
          >
            <div style={{ background: "var(--panel-soft)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)", textAlign: "center" }}>
              <p className="eyebrow" style={{ margin: 0 }}>Hype Clicks 🔥</p>
              <h2 style={{ fontSize: "2rem", margin: "10px 0 0" }}>{stats.total_hype_clicks}</h2>
            </div>
            <div style={{ background: "var(--panel-soft)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)", textAlign: "center" }}>
              <p className="eyebrow" style={{ margin: 0, color: "var(--green)" }}>Público en Recinto 🏃‍♂️</p>
              <h2 style={{ fontSize: "2rem", margin: "10px 0 0" }}>{stats.active_users_in_recinto}</h2>
            </div>
            <div style={{ background: "var(--panel-soft)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)", textAlign: "center" }}>
              <p className="eyebrow" style={{ margin: 0, color: "var(--neon)" }}>Votos Favoritos 🗳️</p>
              <h2 style={{ fontSize: "2rem", margin: "10px 0 0" }}>{stats.favorite_votes_count}</h2>
            </div>

            {/* Active Poll Widget */}
            <div 
              style={{ 
                gridColumn: "1 / -1", 
                background: "var(--panel-soft)", 
                padding: "16px", 
                borderRadius: "8px", 
                border: "1px solid var(--line)", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                flexWrap: "wrap", 
                gap: "10px" 
              }}
            >
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "var(--orange)" }}>Encuesta Activa</p>
                {stats.active_poll ? (
                  <h4 style={{ margin: "6px 0 0" }}>
                    "{stats.active_poll.question}" ({stats.poll_votes_count} votos públicos)
                  </h4>
                ) : (
                  <h4 style={{ margin: "6px 0 0", color: "var(--muted)" }}>Ninguna encuesta activa en vivo</h4>
                )}
              </div>
              {stats.active_poll && (
                <button 
                  onClick={handleDeletePoll}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    background: "var(--danger)",
                    color: "#fff",
                    border: "0",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Eliminar Encuesta
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Active Competitor Controller */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Asignar Competidor en Escena</h2>
          <form className="auth-form" onSubmit={handleSetCompetitor}>
            <label htmlFor="competitor-select">Selecciona el atleta</label>
            {competitors.length === 0 ? (
              <p className="muted">No hay competidores registrados.</p>
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
        </div>

        {/* 3. Judge Evaluation Flow */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px", border: "1px solid var(--neon)" }}>
          <h2>Calificar Competidor Activo (Panel de Juez Admin)</h2>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "10px" }}>
            Atleta activo actual: <strong>{activeAthlete?.name || "Ninguno"}</strong> ({activeAthlete?.modality === "static" ? "Estáticos" : "Dinámicos"})
          </p>

          <form onSubmit={handleVoteScoring} style={{ display: "grid", gap: "18px" }}>
            <div className="slider-stack">
              {CRITERIA.map((criterion) => (
                <label className="score-slider" key={criterion.key}>
                  <span>
                    <b>{criterion.icon}</b>
                    {criterion.label}
                  </span>
                  <output>{judgeScores[criterion.key]}</output>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={judgeScores[criterion.key]}
                    disabled={!activeAthlete?.id}
                    onChange={(event) =>
                      setJudgeScores((current) => ({ ...current, [criterion.key]: Number(event.target.value) }))
                    }
                    style={{ "--fill": `${((judgeScores[criterion.key] - 1) / 9) * 100}%` }}
                  />
                </label>
              ))}
            </div>

            <div className="slider-stack" style={{ borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
              <label className="score-slider">
                <span><b>🔥</b>Calificación Público</span>
                <output>{judgePublicScore}</output>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={judgePublicScore}
                  disabled={!activeAthlete?.id}
                  onChange={(event) => setJudgePublicScore(Number(event.target.value))}
                  style={{ "--fill": `${((judgePublicScore - 1) / 9) * 100}%` }}
                />
              </label>
            </div>

            <button className="primary-btn" type="submit" disabled={scoreSubmitting || !activeAthlete?.id}>
              Enviar Calificación como Juez
            </button>
          </form>

          {scoreResult && (
            <div className="role-result pop-in" style={{ marginTop: "14px" }}>
              <span>Puntaje Publicado</span>
              <div>Componente Jueces (80%): <code>{scoreResult.judges_component}</code></div>
              <div>Componente Público (20%): <code>{scoreResult.public_component}</code></div>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--neon)", marginTop: "4px" }}>
                PUNTAJE FINAL: {scoreResult.final_score}
              </div>
            </div>
          )}
        </div>

        {/* 4. Check-In / Check-Out QR Attendance Flow */}
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

        {/* 5. Live Trivia Dashboard */}
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

        {/* 6. Custom Poll / Survey Creator */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Generar Encuesta de Opinión</h2>
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
        </div>

        {/* 7. Pre-register User Form */}
        <div className="auth-shell" style={{ minHeight: "auto", padding: "20px" }}>
          <h2>Pre-registrar Rol Operativo</h2>
          <form className="auth-form" onSubmit={handleCreate}>
            <label htmlFor="alias-admin">Alias / Nombre de Exhibición</label>
            <input
              id="alias-admin"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Ej: Juez Fuerza 1, Competidor Flow"
              required
            />

            <label htmlFor="username-admin">Nombre de Usuario (Credencial)</label>
            <input
              id="username-admin"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Ej: admin_fuerza, competidor_flow"
              required
              autoComplete="off"
            />

            <label htmlFor="password-admin">Contraseña</label>
            <input
              id="password-admin"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingrese contraseña de ingreso"
              required
              autoComplete="new-password"
            />

            <label htmlFor="role-select">Rol asignado</label>
            <select
              id="role-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              style={{
                background: "#0a0c10",
                color: "var(--text)",
                minHeight: "56px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "0 16px",
                fontFamily: "inherit"
              }}
            >
              <option value="staff">Staff (Registro/Asistencia/Trivias)</option>
              <option value="judge">Juez (Evaluación Técnica)</option>
              <option value="competitor">Competidor (Deportista)</option>
              <option value="admin">Administrador (Gestor total)</option>
            </select>

            {newRole === "competitor" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <div>
                  <label htmlFor="weight-admin">Peso (kg)</label>
                  <input
                    id="weight-admin"
                    type="number"
                    step="0.1"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="Ej: 72.5"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="category-admin">Categoría</label>
                  <input
                    id="category-admin"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ej: Elite, Avanzado"
                    required
                  />
                </div>
              </div>
            )}

            <button className="primary-btn" type="submit" style={{ marginTop: "15px" }}>
              Crear Usuario
            </button>
          </form>
        </div>

        {/* Edit Modal (Inline form if editing) */}
        {editingUser && (
          <div className="auth-shell" style={{ minHeight: "auto", padding: "20px", border: "2px solid var(--neon)" }}>
            <h2>Editar Usuario</h2>
            <form className="auth-form" onSubmit={handleUpdate}>
              <label>Alias / Nombre de Exhibición</label>
              <input value={editAlias} onChange={(e) => setEditAlias(e.target.value)} required />

              <label>Nombre de Usuario</label>
              <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />

              <label>Contraseña (Dejar en blanco para no cambiar)</label>
              <input 
                type="password" 
                value={editPassword} 
                onChange={(e) => setEditPassword(e.target.value)} 
                placeholder="Nueva contraseña" 
              />

              <label>Rol</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                style={{
                  background: "#0a0c10",
                  color: "var(--text)",
                  minHeight: "56px",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "0 16px"
                }}
              >
                <option value="user">Público (User)</option>
                <option value="staff">Staff</option>
                <option value="judge">Juez</option>
                <option value="competitor">Competidor</option>
                <option value="admin">Admin</option>
              </select>

              <label>Estado en Recinto</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{
                  background: "#0a0c10",
                  color: "var(--text)",
                  minHeight: "56px",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "0 16px"
                }}
              >
                <option value="inactive">Inactivo / Fuera</option>
                <option value="active">Activo / Dentro</option>
              </select>

              {editRole === "competitor" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  <div>
                    <label>Peso (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      placeholder="Ej: 72.5"
                      required
                    />
                  </div>
                  <div>
                    <label>Categoría</label>
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="Ej: Elite, Avanzado"
                      required
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button className="primary-btn" type="submit" style={{ flex: 1 }}>
                  Guardar
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ flex: 1, background: "var(--panel-soft)", color: "var(--text)", borderColor: "var(--line)" }}
                  onClick={() => setEditingUser(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User list */}
        <div style={{ background: "var(--panel)", borderRadius: "8px", border: "1px solid var(--line)", padding: "16px" }}>
          <h2>Lista de Usuarios ({users.length})</h2>
          {loading ? (
            <p className="muted">Cargando...</p>
          ) : (
            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--panel-soft)",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <strong>{u.alias}</strong>{" "}
                    <span
                      style={{
                        fontSize: "0.8rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background:
                          u.role === "admin"
                            ? "var(--orange)"
                            : u.role === "judge"
                            ? "var(--neon)"
                            : u.role === "staff"
                            ? "var(--green)"
                            : "var(--panel)",
                        color: u.role === "judge" ? "#111" : "#fff",
                        marginLeft: "6px"
                      }}
                    >
                      {u.role}
                    </span>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "4px" }}>
                      Usuario: <code>{u.username || "Ninguno"}</code>
                    </div>
                    {u.role === "competitor" && (u.weight || u.category) && (
                      <div style={{ fontSize: "0.85rem", color: "var(--text)", marginTop: "4px" }}>
                        ⚖️ {u.weight ? `${u.weight} kg` : "N/A"} | 🏷️ {u.category || "N/A"}
                      </div>
                    )}
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "4px" }}>
                      Estado: <span style={{ color: u.status === "active" ? "var(--green)" : "var(--muted)" }}>{u.status}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => startEdit(u)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "none",
                        border: "1px solid var(--neon)",
                        color: "var(--neon)",
                        cursor: "pointer"
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "none",
                        border: "1px solid var(--danger)",
                        color: "var(--danger)",
                        cursor: "pointer"
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {success && <p style={{ color: "var(--green)", marginTop: "10px", textAlign: "center" }}>{success}</p>}
      {error && <p className="error-text" style={{ marginTop: "10px", textAlign: "center" }}>{error}</p>}
    </section>
  );
}

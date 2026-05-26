import { useEffect, useMemo, useState } from "react";

import AuthExpress from "./components/AuthExpress.js";
import HypeTrivia from "./components/HypeTrivia.js";
import LiveVoting from "./components/LiveVoting.js";
import RadarChartComponent from "./components/RadarChartComponent.js";
import RoleLogin from "./components/RoleLogin.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import JudgeDashboard from "./components/JudgeDashboard.jsx";
import StaffDashboard from "./components/StaffDashboard.jsx";
import { LiveSocket } from "./services/websocket.js";
import { apiRequest } from "./services/api.js";

const FALLBACK_EVENT = {
  eventId: "main-stage",
  athlete: { id: "ath-1", name: "Atleta en escena" },
  modality: "dynamic",
  startedAt: Date.now(),
  trivia: null,
  poll: null,
  competitors: [
    { id: "a", name: "Flow Barz", scores: [8.2, 8.8, 7.6, 8.4], total: 8.3 },
    { id: "b", name: "Static Crew", scores: [7.4, 9.2, 8.1, 7.8], total: 8.1 },
  ],
};

export default function App() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem("workcalist.session");
    return stored ? JSON.parse(stored) : null;
  });
  const [view, setView] = useState("public");
  const [socketStatus, setSocketStatus] = useState("idle");
  const [eventState, setEventState] = useState(FALLBACK_EVENT);
  const [now, setNow] = useState(Date.now());
  const [lastSocketMessage, setLastSocketMessage] = useState(null);

  // Competitor prize voting states
  const [prizeResults, setPrizeResults] = useState(null);
  const [prizeVoted, setPrizeVoted] = useState(() => {
    return localStorage.getItem(`workcalist.voted_prize.${session?.user_id}`) === "true";
  });
  const [prizeLoading, setPrizeLoading] = useState(false);

  // Global Hype meter state
  const [globalHype, setGlobalHype] = useState(0);

  // Poll favorite athlete state
  const [favoritesResults, setFavoritesResults] = useState([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Decay the global Hype meter level slightly every second
  useEffect(() => {
    const decay = window.setInterval(() => {
      setGlobalHype((h) => Math.max(0, h - 3));
    }, 1000);
    return () => window.clearInterval(decay);
  }, []);

  // Load competitor prize results and favorites when appropriate
  useEffect(() => {
    if (!session?.access_token) return;

    if (session.role === "competitor") {
      apiRequest("/api/interaction/prize-vote/results", { token: session.access_token })
        .then(setPrizeResults)
        .catch(console.error);
    }

    apiRequest("/api/interaction/favorite/results")
      .then(setFavoritesResults)
      .catch(console.error);
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) return undefined;

    const liveSocket = new LiveSocket({
      token: session.access_token,
      onStatus: setSocketStatus,
      onMessage: (message) => {
        setLastSocketMessage(message);

        if (message.type === "competition-state") {
          setEventState((current) => ({ ...current, ...message.payload }));
        }
        if (message.type === "trivia-launched") {
          setEventState((current) => ({ ...current, trivia: message.trivia }));
        }
        if (message.type === "poll-launched") {
          setEventState((current) => ({ ...current, poll: message.poll }));
        }
        if (message.type === "poll-vote-update") {
          setEventState((current) => {
            const nextPoll = current.poll ? { ...current.poll, tally: message.tally, total: message.total } : null;
            return { ...current, poll: nextPoll };
          });
        }
        if (message.type === "favorites-update") {
          setFavoritesResults(message.results);
        }
        if (message.type === "hype") {
          // Increase global hype meter
          setGlobalHype((h) => Math.min(100, h + message.clicks * 2));
        }
        if (message.type === "attendance" && message.user_id === session.user_id) {
          const nextSession = { ...session, status: message.action === "check-in" ? "active" : "inactive" };
          localStorage.setItem("workcalist.session", JSON.stringify(nextSession));
          setSession(nextSession);
        }
      },
    });

    liveSocket.connect();
    return () => liveSocket.close();
  }, [session]);

  const elapsedSeconds = useMemo(
    () => Math.max(0, Math.floor((now - eventState.startedAt) / 1000)),
    [eventState.startedAt, now],
  );

  const active = session?.status === "active";
  const isOperational = session && ["admin", "judge", "staff", "competitor"].includes(session.role);

  function handleLogout() {
    localStorage.removeItem("workcalist.session");
    setSession(null);
    setView("public");
  }

  async function handleVotePrize(optionId) {
    setPrizeLoading(true);
    try {
      await apiRequest("/api/interaction/prize-vote", {
        token: session.access_token,
        method: "POST",
        body: { option_id: optionId }
      });
      localStorage.setItem(`workcalist.voted_prize.${session.user_id}`, "true");
      setPrizeVoted(true);
      
      const data = await apiRequest("/api/interaction/prize-vote/results", { token: session.access_token });
      setPrizeResults(data);
    } catch (err) {
      alert("Error al votar: " + err.message);
    } finally {
      setPrizeLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <button className={view === "public" ? "nav-active" : ""} onClick={() => setView("public")}>
          Público
        </button>
        <button className={view === "event" ? "nav-active" : ""} onClick={() => setView("event")}>
          Evento
        </button>
        <button className={view === "roles" ? "nav-active" : ""} onClick={() => setView("roles")}>
          {isOperational ? "Operación" : "Ingreso Operativo"}
        </button>
        <span className={`socket-dot ${socketStatus}`}>{socketStatus}</span>
      </nav>

      {view === "roles" ? (
        !isOperational ? (
          <RoleLogin onLogin={(sess) => setSession(sess)} />
        ) : session.role === "admin" ? (
          <AdminPanel 
            session={session} 
            onLogout={handleLogout} 
            socketMessage={lastSocketMessage} 
            activeAthlete={eventState.athlete} 
          />
        ) : session.role === "judge" ? (
          <JudgeDashboard session={session} activeAthlete={eventState.athlete} onLogout={handleLogout} />
        ) : session.role === "staff" ? (
          <StaffDashboard session={session} onLogout={handleLogout} socketMessage={lastSocketMessage} />
        ) : (
          /* Competitor dashboard - simple display of their stats / radar & surprise prizes */
          <section className="role-shell pop-in">
            <div className="role-heading">
              <p className="eyebrow">Panel de Competidor</p>
              <h1>Tus Estadísticas en Vivo</h1>
              <p className="muted">Consulta tu desempeño en tiempo real calculado por los jueces.</p>
              <button 
                style={{ marginTop: "16px", background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }} 
                className="primary-btn" 
                onClick={handleLogout}
              >
                Cerrar Sesión
              </button>
            </div>
            <div className="mobile-flow" style={{ marginTop: "24px" }}>
              <div className="live-card">
                <h2>{session.alias}</h2>
                <p className="muted">Compite y mantente al tanto del Leaderboard en la pestaña de Evento.</p>
                <div style={{ marginTop: "20px" }}>
                  <RadarChartComponent competitors={eventState.competitors.filter(c => c.name === session.alias)} />
                </div>
              </div>

              {/* Surprise Prize Interaction */}
              <div className="live-card" style={{ marginTop: "16px" }}>
                <p className="eyebrow" style={{ color: "var(--orange)" }}>Premio Sorpresa (3er Puesto)</p>
                <h3>Elige el premio que prefieres</h3>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                  Los competidores votan democráticamente qué premio sorpresa se entregará en el tercer lugar.
                </p>

                {prizeVoted && prizeResults ? (
                  <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
                    <div>
                      <span>🎁 Kit de Magnesio + Correas:</span>
                      <strong> {prizeResults.percentages?.A || 0}%</strong>
                    </div>
                    <div>
                      <span>🤸‍♂️ Paralelas de Madera:</span>
                      <strong> {prizeResults.percentages?.B || 0}%</strong>
                    </div>
                    <div>
                      <span>💪 Rueda Abdominal + Banda:</span>
                      <strong> {prizeResults.percentages?.C || 0}%</strong>
                    </div>
                    <p className="muted" style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                      Votos Totales del grupo: {prizeResults.total_votes}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
                    <button 
                      className="primary-btn" 
                      style={{ background: "var(--panel-soft)", color: "var(--text)", border: "1px solid var(--line)" }} 
                      onClick={() => handleVotePrize("A")}
                      disabled={prizeLoading}
                    >
                      🎁 Kit Magnesio + Correas Straps
                    </button>
                    <button 
                      className="primary-btn" 
                      style={{ background: "var(--panel-soft)", color: "var(--text)", border: "1px solid var(--line)" }} 
                      onClick={() => handleVotePrize("B")}
                      disabled={prizeLoading}
                    >
                      🤸‍♂️ Paralelas de Madera Premium
                    </button>
                    <button 
                      className="primary-btn" 
                      style={{ background: "var(--panel-soft)", color: "var(--text)", border: "1px solid var(--line)" }} 
                      onClick={() => handleVotePrize("C")}
                      disabled={prizeLoading}
                    >
                      💪 Banda Resistencia Pro + Rueda
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )
      ) : view === "public" ? (
        <div className="mobile-flow">
          <AuthExpress session={session} onSession={setSession} competitors={eventState.competitors} />
          {session ? (
            <>
              <LiveVoting
                athlete={eventState.athlete}
                modality={eventState.modality}
                elapsedSeconds={elapsedSeconds}
                disabled={!active}
              />
              <HypeTrivia
                token={session.access_token}
                eventId={eventState.eventId}
                trivia={eventState.trivia}
                poll={eventState.poll}
                active={active}
              />
            </>
          ) : null}
        </div>
      ) : (
        <RadarChartComponent 
          competitors={eventState.competitors} 
          favorites={favoritesResults} 
          globalHype={globalHype}
        />
      )}
    </main>
  );
}

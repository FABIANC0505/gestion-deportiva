import { useEffect, useMemo, useState } from "react";

import AuthExpress from "./components/AuthExpress.js";
import HypeTrivia from "./components/HypeTrivia.js";
import LiveVoting from "./components/LiveVoting.js";
import RadarChartComponent from "./components/RadarChartComponent.js";
import RoleRegistry from "./components/RoleRegistry.js";
import { LiveSocket } from "./services/websocket.js";

const FALLBACK_EVENT = {
  eventId: "main-stage",
  athlete: { id: "ath-1", name: "Atleta en escena" },
  modality: "dynamic",
  startedAt: Date.now(),
  trivia: null,
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session?.access_token) return undefined;

    const liveSocket = new LiveSocket({
      token: session.access_token,
      onStatus: setSocketStatus,
      onMessage: (message) => {
        if (message.type === "competition-state") {
          setEventState((current) => ({ ...current, ...message.payload }));
        }
        if (message.type === "trivia-launched") {
          setEventState((current) => ({ ...current, trivia: message.trivia }));
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
          Roles
        </button>
        <span className={`socket-dot ${socketStatus}`}>{socketStatus}</span>
      </nav>

      {view === "roles" ? (
        <RoleRegistry />
      ) : view === "public" ? (
        <div className="mobile-flow">
          <AuthExpress session={session} onSession={setSession} />
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
                active={active}
              />
            </>
          ) : null}
        </div>
      ) : (
        <RadarChartComponent competitors={eventState.competitors} />
      )}
    </main>
  );
}

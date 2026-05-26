import { useState } from "react";
import { apiRequest } from "../services/api.js";

export default function RoleLogin({ onLogin }) {
  const [alias, setAlias] = useState("");
  const [accessCode, setAccessCode] = useState("STAFF-LOCAL-2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Calls staff-login endpoint which checks access code and pre-registered alias.
      // If no admin exists in the system and role = admin, it bootstraps it!
      const session = await apiRequest("/api/auth/staff-login", {
        method: "POST",
        body: { 
          alias: alias.trim(), 
          access_code: accessCode,
          role: "admin" // Send role = admin in case of bootstrap fallback
        },
      });
      localStorage.setItem("workcalist.session", JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="role-shell pop-in">
      <div className="role-heading">
        <p className="eyebrow">Acceso Operativo</p>
        <h1>Ingreso del Personal</h1>
        <p className="muted">Inicia sesión como Administrador, Juez, Staff o Competidor usando tu alias registrado y el código del evento.</p>
      </div>

      <form className="role-form" onSubmit={handleSubmit}>
        <label>
          Alias registrado
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Ej: Juez Fuerza 1, Staff Entrada"
            minLength={2}
            maxLength={40}
            required
            autoComplete="username"
          />
        </label>

        <label>
          Código de acceso del evento
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            type="password"
            minLength={6}
            maxLength={80}
            required
            autoComplete="current-password"
          />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Iniciando sesión..." : "Ingresar"}
        </button>
      </form>

      {error && <p className="error-text" style={{ marginTop: "10px" }}>{error}</p>}
    </section>
  );
}

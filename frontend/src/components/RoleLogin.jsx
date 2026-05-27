import { useState } from "react";
import { apiRequest } from "../services/api.js";

export default function RoleLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Calls staff-login endpoint which checks username and password.
      const session = await apiRequest("/api/auth/staff-login", {
        method: "POST",
        body: { 
          username: username.trim(), 
          password: password
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
        <p className="muted">Inicia sesión como Administrador, Juez, Staff o Competidor usando tus credenciales registradas.</p>
      </div>

      <form className="role-form" onSubmit={handleSubmit}>
        <label>
          Nombre de usuario
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Ej: admin, juez_fuerza"
            minLength={2}
            maxLength={40}
            required
            autoComplete="username"
          />
        </label>

        <label>
          Contraseña
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={4}
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

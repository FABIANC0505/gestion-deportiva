import { useState } from "react";

import { registerRole } from "../services/api.js";

const ROLES = [
  { value: "staff", label: "Staff", hint: "Escanea QR y controla asistencia." },
  { value: "admin", label: "Admin", hint: "Supervisa dashboard y operación." },
  { value: "judge", label: "Juez", hint: "Califica aspectos técnicos." },
  { value: "competitor", label: "Competidor", hint: "Consulta estadísticas." },
];

export default function RoleRegistry() {
  const [alias, setAlias] = useState("");
  const [role, setRole] = useState("staff");
  const [accessCode, setAccessCode] = useState("STAFF-LOCAL-2026");
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const nextSession = await registerRole({ alias: alias.trim(), role, accessCode });
      localStorage.setItem(`workcalist.${role}.session`, JSON.stringify(nextSession));
      setCreated(nextSession);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="role-shell">
      <div className="role-heading">
        <p className="eyebrow">Registro de roles</p>
        <h1>Accesos operativos del evento</h1>
        <p className="muted">Crea tokens locales para Staff, Admin, Jueces y Competidores.</p>
      </div>

      <form className="role-form" onSubmit={handleSubmit}>
        <label>
          Alias operativo
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Ej: Staff Entrada 1"
            minLength={2}
            maxLength={40}
            required
          />
        </label>

        <div className="role-options" role="radiogroup" aria-label="Rol">
          {ROLES.map((item) => (
            <label className={role === item.value ? "role-option selected" : "role-option"} key={item.value}>
              <input
                type="radio"
                name="role"
                value={item.value}
                checked={role === item.value}
                onChange={(event) => setRole(event.target.value)}
              />
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </label>
          ))}
        </div>

        <label>
          Código de acceso
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            type="password"
            minLength={6}
            maxLength={80}
            required
          />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Creando acceso..." : "Registrar rol"}
        </button>
      </form>

      {created ? (
        <div className="role-result pop-in">
          <span>{created.role}</span>
          <strong>{created.alias}</strong>
          <code>{created.user_id}</code>
          <p className="muted">Token guardado localmente para esta estación.</p>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

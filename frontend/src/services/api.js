const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiRequest(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "No se pudo completar la solicitud");
  }

  return response.json();
}

export function registerExpress(alias) {
  return apiRequest("/api/auth/register-express", {
    method: "POST",
    body: { alias },
  });
}

export function sendHype(token, eventId, clicks = 1) {
  return apiRequest("/api/interaction/hype", {
    token,
    method: "POST",
    body: { event_id: eventId, clicks },
  });
}

export function submitTriviaAnswer(token, triviaId, answerId) {
  return apiRequest("/api/interaction/trivias/answer", {
    token,
    method: "POST",
    body: { trivia_id: triviaId, answer_id: answerId },
  });
}

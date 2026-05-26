// Centralized API base URL. Vite injects VITE_API_URL at build time.
// Falls back to localhost for `npm run dev` without an .env file.
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8080';

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || body?.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined as T;
  return (await res.json()) as T;
}

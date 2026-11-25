export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw new HttpError(res.status, `${res.status} ${await res.text().catch(() => '')}`.trim());
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

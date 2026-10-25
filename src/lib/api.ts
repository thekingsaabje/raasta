export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = (data as any).issues as { path: string; message: string }[] | undefined;
    const msg = (data as any).error ?? "Request failed";
    throw new ApiError(res.status, issues?.length ? `${msg} ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}` : msg, issues);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>("GET", p),
  post: <T = any>(p: string, b: unknown = {}) => request<T>("POST", p, b),
  put: <T = any>(p: string, b: unknown) => request<T>("PUT", p, b),
  patch: <T = any>(p: string, b: unknown) => request<T>("PATCH", p, b),
  del: <T = any>(p: string) => request<T>("DELETE", p),
};

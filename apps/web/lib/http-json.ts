/** Safe JSON parsing for fetch responses (handles HTML error pages). */

export class HttpJsonError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpJsonError';
    this.status = status;
  }
}

function htmlResponseMessage(status: number): string {
  if (status >= 500) return `Server error (HTTP ${status}). Retry in a moment.`;
  if (status === 404) return `API route not found (HTTP 404). Restart the dev server if this persists.`;
  return `Unexpected HTML response (HTTP ${status}). Retry in a moment.`;
}

export function parseJsonText<T>(text: string, status = 0): T {
  const trimmed = text.trimStart();
  if (!trimmed) {
    throw new HttpJsonError('Empty response from server', status);
  }
  if (trimmed.startsWith('<')) {
    throw new HttpJsonError(htmlResponseMessage(status), status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpJsonError(`Invalid JSON response (HTTP ${status})`, status);
  }
}

export async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return parseJsonText<T>(text, res.status);
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ response: Response; data: T }> {
  const response = await fetch(url, init);
  const data = await readResponseJson<T>(response);
  return { response, data };
}

/** Client-side API helper with one retry when the dev server returns HTML mid-compile. */
export async function fetchApiJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ response: Response; data: T }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, init);
      const data = await readResponseJson<T>(response);
      return { response, data };
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof HttpJsonError &&
        (err.status >= 500 || err.message.includes('HTML') || err.message.includes('Empty'));
      if (!retryable || attempt === 1) break;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastError;
}

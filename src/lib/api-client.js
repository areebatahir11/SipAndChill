/** Browser-side fetch helper: one place for JSON headers and error handling. Returns `data` or throws Error(message). */
export async function api(url, { method = 'GET', body } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData; // file upload: the browser sets the multipart header itself
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || 'Request failed.');
  return json.data;
}

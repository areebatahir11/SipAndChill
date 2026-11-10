import { HttpError } from '@/lib/http';

/**
 * Reads ONE uploaded file (multipart) from a request, refusing an oversized upload from its declared length
 * before it is read into memory. Returns { file, form } (form carries any extra text fields).
 */
export async function readUpload(request, field, { maxBytes, missing, tooBig }) {
  if (Number(request.headers.get('content-length')) > maxBytes + 64 * 1024) throw new HttpError(413, tooBig, 'VALIDATION');
  const form = await request.formData().catch(() => { throw new HttpError(400, missing, 'VALIDATION'); });
  const file = form.get(field);
  if (!file || typeof file === 'string') throw new HttpError(400, missing, 'VALIDATION');
  if (file.size > maxBytes) throw new HttpError(413, tooBig, 'VALIDATION');
  return { file, form };
}

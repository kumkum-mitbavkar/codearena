// Fresh reads and guarded writes on a private Vercel Blob store.
//
// An overwritten public blob can be served stale for several seconds, so two quick submissions
// could build on an old copy and silently drop the first one.
// Private blobs are read with the cache skipped, and each save is conditional on the ETag
// from the last read, so a write based on an out-of-date copy is refused instead of lost.
import { put, get, BlobPreconditionFailedError } from '@vercel/blob';

const token = () => process.env.DATA_READ_WRITE_TOKEN;
const etags = new Map(); // pathname -> ETag from the most recent read in this instance

// Larger files come back compressed with a weak ETag (W/"…"). The write precondition only
// matches the strong form, which is the same value without the prefix.
const strong = (etag) => (etag ? String(etag).replace(/^W\//, '') : etag);

export class ConflictError extends Error {
  constructor() {
    super('Someone else updated this at the same moment. Please try again.');
    this.status = 409;
  }
}

/** Reads a JSON file; returns undefined when it doesn't exist yet. */
export async function readPrivate(pathname) {
  if (!token()) return undefined;
  const res = await get(pathname, { access: 'private', token: token(), useCache: false });
  if (!res || res.statusCode !== 200) { etags.set(pathname, null); return undefined; }
  etags.set(pathname, strong(res.blob.etag));
  return JSON.parse(await new Response(res.stream).text());
}

/** Writes a JSON file, refusing if it changed since this instance last read it. */
export async function writePrivate(pathname, value) {
  if (!token()) throw new Error('Storage is not configured');
  const etag = etags.get(pathname);
  try {
    const blob = await put(pathname, JSON.stringify(value), {
      access: 'private',
      token: token(),
      contentType: 'application/json',
      addRandomSuffix: false,
      ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: etag === null ? false : true }),
    });
    if (blob && blob.etag) etags.set(pathname, strong(blob.etag));
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError || /precondition|already exists/i.test(err.message)) throw new ConflictError();
    throw err;
  }
  return value;
}

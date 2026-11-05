// A file-backed stand-in for the Blob store, used only when running locally without a token
// (`npm run dev`). Same read/write shape as private-store.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const dir = () => process.env.CODEARENA_DATA_DIR || path.join(process.cwd(), '.data');
const fileFor = (pathname) => path.join(dir(), pathname.replace(/[\\/]/g, '__'));

export async function readLocal(pathname) {
  try {
    return JSON.parse(await readFile(fileFor(pathname), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

export async function writeLocal(pathname, value) {
  await mkdir(dir(), { recursive: true });
  await writeFile(fileFor(pathname), JSON.stringify(value));
  return value;
}

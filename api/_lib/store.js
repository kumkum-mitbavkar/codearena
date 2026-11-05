// The whole app state (admin-edited problems, submissions) lives in one JSON document:
// a private Vercel Blob in production, a local file in development.
import { readPrivate, writePrivate } from './private-store.js';
import { readLocal, writeLocal } from './local-store.js';
import { sampleHistory } from './sample-history.js';

const PATH = 'codearena/v1/data.json';
const MAX_SUBMISSIONS = 3000;
const useBlob = () => Boolean(process.env.DATA_READ_WRITE_TOKEN);

function fresh() {
  return { version: 1, createdAt: new Date().toISOString(), problems: {}, submissions: sampleHistory(Date.now()) };
}

export async function load() {
  const stored = useBlob() ? await readPrivate(PATH) : await readLocal(PATH);
  if (stored) return stored;
  const data = fresh();
  await save(data);
  return data;
}

export async function save(data) {
  if (data.submissions.length > MAX_SUBMISSIONS) {
    // keep the sample history (it feeds the demo profile) and the newest real submissions
    const sample = data.submissions.filter((s) => s.sample);
    const real = data.submissions.filter((s) => !s.sample).slice(-(MAX_SUBMISSIONS - sample.length));
    data.submissions = [...sample, ...real];
  }
  return useBlob() ? writePrivate(PATH, data) : writeLocal(PATH, data);
}

/** Back to the starter state: seed problems only and the demo's sample history. */
export async function reset() {
  if (useBlob()) await readPrivate(PATH); // fresh ETag so the overwrite is accepted
  const data = fresh();
  await save(data);
  return data;
}

// lib/kv.js
// Thin wrapper around Vercel KV REST API so we don't need the SDK at runtime.
// Works both locally (with .env.local) and on Vercel (env vars injected automatically).

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function kvFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`KV error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getQueue() {
  try {
    const data = await kvFetch("/get/queue");
    return data.result ? JSON.parse(data.result) : [];
  } catch {
    return [];
  }
}

export async function setQueue(queue) {
  await kvFetch("/set/queue", {
    method: "POST",
    body: JSON.stringify(JSON.stringify(queue)),
  });
}

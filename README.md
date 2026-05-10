# 🎵 Votify — Collaborative Music Queue

A shared music voting queue where anyone can search YouTube Music, add songs, and vote for what plays next — no login required.

---

## How it works

- Anyone with the link can **search YouTube Music** and add songs
- Each person gets an anonymous voter token (stored in their browser)
- Songs are **sorted by votes** — the most-voted song plays next
- The queue syncs automatically every 4 seconds across all users
- The song at the top has a direct **"Open in YouTube Music"** link for the DJ to play

---

## Setup (5 minutes)

### 1. Clone and install

```bash
git clone <your-repo>
cd musicvote
npm install
```

### 2. Get a YouTube Data API v3 key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable **YouTube Data API v3**
4. Go to **Credentials → Create Credentials → API Key**
5. (Recommended) Restrict the key to "YouTube Data API v3" and your Vercel domain

### 3. Set up Vercel KV (Redis)

1. Push this project to GitHub
2. Import it on [Vercel](https://vercel.com)
3. In your Vercel project dashboard → **Storage → Create Database → KV**
4. Connect it to your project — Vercel will auto-inject `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### 4. Configure environment variables

In Vercel dashboard → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `YOUTUBE_API_KEY` | Your YouTube Data API v3 key |
| `ADMIN_SECRET` | Any random string (used to mark songs as played) |

For local dev, copy `.env.local.example` to `.env.local` and fill it in.

### 5. Deploy

```bash
vercel deploy
```

That's it! Share the URL with everyone.

---

## Marking a song as played

When a song finishes, remove it from the top of the queue with:

```bash
curl -X DELETE https://your-site.vercel.app/api/queue \
  -H "Content-Type: application/json" \
  -d '{"secret": "your_admin_secret"}'
```

Or build a small admin page / button that calls this endpoint.

---

## Architecture

```
pages/
  index.js          — Frontend UI (React, no framework deps)
  api/
    queue.js        — Queue CRUD: add, vote, unvote, remove top
    search.js       — YouTube Data API proxy (keeps key server-side)
lib/
  kv.js             — Vercel KV (Redis) wrapper
```

- **State**: Vercel KV (Redis) — queue stored as a JSON array
- **Real-time**: 4-second polling (simple, works everywhere)
- **Auth**: None — anonymous voter tokens in localStorage
- **Search**: YouTube Data API v3 (proxied server-side)

---

## Local development

```bash
cp .env.local.example .env.local
# fill in YOUTUBE_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_SECRET

npm run dev
# → http://localhost:3000
```

You need a real Vercel KV database even for local dev (it's free tier is generous). Alternatively, swap `lib/kv.js` for a simple in-memory or file-based store for testing.

---

## Customisation ideas

- **Admin panel**: Add a password-protected page to mark songs played, clear queue, ban songs
- **Now playing indicator**: Auto-remove top song after its duration elapses
- **Duplicate prevention**: Already done — adding a queued song just registers your vote
- **Vote limits**: Limit each user to N votes per session
- **WebSockets**: Replace polling with Vercel's Realtime / Pusher for instant sync

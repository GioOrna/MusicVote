// pages/api/queue.js
import { getQueue, setQueue } from "../../lib/kv";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // GET /api/queue — return sorted queue
  if (req.method === "GET") {
    const queue = await getQueue();
    const sorted = [...queue].sort((a, b) => b.votes - a.votes);
    return res.status(200).json({ queue: sorted });
  }

  // POST /api/queue — add song or vote
  if (req.method === "POST") {
    const { action, song, queuedId, voterToken } = req.body;

    if (!voterToken) return res.status(400).json({ error: "Missing voterToken" });

    const queue = await getQueue();

    if (action === "add") {
      // Check if already in queue (by videoId)
      const exists = queue.find((s) => s.videoId === song.videoId);
      if (exists) {
        // Instead of duplicating, just register a vote if not already voted
        if (!exists.voters.includes(voterToken)) {
          exists.votes += 1;
          exists.voters.push(voterToken);
        }
        await setQueue(queue);
        return res.status(200).json({ queue: [...queue].sort((a, b) => b.votes - a.votes) });
      }

      const entry = {
        id: generateId(),
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
        duration: song.duration,
        votes: 1,
        voters: [voterToken],
        addedAt: Date.now(),
      };
      queue.push(entry);
      await setQueue(queue);
      return res.status(201).json({ queue: [...queue].sort((a, b) => b.votes - a.votes) });
    }

    if (action === "vote") {
      const item = queue.find((s) => s.id === queuedId);
      if (!item) return res.status(404).json({ error: "Song not found in queue" });
      if (item.voters.includes(voterToken)) {
        return res.status(409).json({ error: "Already voted" });
      }
      item.votes += 1;
      item.voters.push(voterToken);
      await setQueue(queue);
      return res.status(200).json({ queue: [...queue].sort((a, b) => b.votes - a.votes) });
    }

    if (action === "unvote") {
      const item = queue.find((s) => s.id === queuedId);
      if (!item) return res.status(404).json({ error: "Song not found in queue" });
      if (!item.voters.includes(voterToken)) {
        return res.status(409).json({ error: "Not voted" });
      }
      item.votes -= 1;
      item.voters = item.voters.filter((v) => v !== voterToken);
      await setQueue(queue);
      return res.status(200).json({ queue: [...queue].sort((a, b) => b.votes - a.votes) });
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  // DELETE /api/queue — mark top song as played (admin/player only)
  if (req.method === "DELETE") {
    const { secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const queue = await getQueue();
    const sorted = [...queue].sort((a, b) => b.votes - a.votes);
    sorted.shift(); // remove top song
    await setQueue(sorted);
    return res.status(200).json({ queue: sorted });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

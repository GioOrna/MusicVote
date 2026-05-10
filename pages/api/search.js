// pages/api/search.js
// Proxies YouTube Data API v3 search so the key is never exposed to the client.

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query" });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "YouTube API key not configured" });

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10"); // Music category
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("key", apiKey);

  try {
    const ytRes = await fetch(url.toString());
    const data = await ytRes.json();

    if (!ytRes.ok) {
      return res.status(502).json({ error: data.error?.message || "YouTube API error" });
    }

    // Fetch durations in a second call
    const ids = data.items.map((i) => i.id.videoId).join(",");
    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "contentDetails");
    detailUrl.searchParams.set("id", ids);
    detailUrl.searchParams.set("key", apiKey);
    const detailRes = await fetch(detailUrl.toString());
    const detailData = await detailRes.json();
    const durationMap = {};
    for (const item of detailData.items || []) {
      durationMap[item.id] = parseDuration(item.contentDetails.duration);
    }

    const songs = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      duration: durationMap[item.id.videoId] || null,
    }));

    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({ songs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function parseDuration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  const total = h * 3600 + m * 60 + s;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

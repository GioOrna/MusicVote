// pages/index.js
import { useState, useEffect, useRef, useCallback } from "react";

// ── Voter token (stored in localStorage, generated once per browser) ──────────
function getVoterToken() {
  if (typeof window === "undefined") return "ssr";
  let t = localStorage.getItem("mv_token");
  if (!t) {
    t = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mv_token", t);
  }
  return t;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useDebounce(value, ms) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Home() {
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [voterToken, setVoterToken] = useState("init");
  const [adding, setAdding] = useState(null);
  const [voting, setVoting] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 450);

  // Init voter token client-side
  useEffect(() => { setVoterToken(getVoterToken()); }, []);

  // Poll queue every 4 seconds
  const fetchQueue = useCallback(async () => {
    try {
      const r = await fetch("/api/queue");
      const d = await r.json();
      setQueue(d.queue || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 4000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  // YouTube search
  useEffect(() => {
    if (!debouncedSearch.trim()) { setResults([]); return; }
    setSearching(true);
    setSearchErr(null);
    fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}`)
      .then(r => r.json())
      .then(d => {
        setResults(d.songs || []);
        if (d.error) setSearchErr(d.error);
      })
      .catch(() => setSearchErr("Search failed"))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  // Focus search input when panel opens
  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 80);
  }, [showSearch]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = async (song) => {
    setAdding(song.videoId);
    try {
      const r = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", song, voterToken }),
      });
      const d = await r.json();
      if (d.error) { showToast(d.error, "err"); }
      else { setQueue(d.queue); showToast("Added & voted! 🎵"); }
    } catch { showToast("Error adding song", "err"); }
    setAdding(null);
    setShowSearch(false);
    setSearch("");
    setResults([]);
  };

  const handleVote = async (item) => {
    const hasVoted = item.voters?.includes(voterToken);
    setVoting(item.id);
    try {
      const r = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: hasVoted ? "unvote" : "vote",
          queuedId: item.id,
          voterToken,
        }),
      });
      const d = await r.json();
      if (d.error) showToast(d.error, "err");
      else { setQueue(d.queue); showToast(hasVoted ? "Vote removed" : "Vote cast! 🔥"); }
    } catch { showToast("Error voting", "err"); }
    setVoting(null);
  };

  const topSong = queue[0] || null;
  const upNext = queue.slice(1);

  return (
    <>
      <style>{styles}</style>

      {/* Background orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />

      <div className="layout">
        {/* ── Header ── */}
        <header className="header">
          <div className="logo">
            <span className="logo-icon">▶</span>
            <span className="logo-text">VOTIFY</span>
          </div>
          <p className="tagline">Collective queue · everyone votes · best song wins</p>
          <button className="add-btn" onClick={() => setShowSearch(true)}>
            <span>+</span> Add a song
          </button>
        </header>

        {/* ── Now playing / top voted ── */}
        <section className="now-section">
          <div className="section-label">▲ TOP VOTED — PLAYS NEXT</div>
          {topSong ? (
            <NowCard song={topSong} voterToken={voterToken} onVote={handleVote} voting={voting} />
          ) : (
            <div className="empty-card">
              <div className="empty-icon">♫</div>
              <p>Queue is empty — be the first to add a song!</p>
              <button className="add-btn sm" onClick={() => setShowSearch(true)}>+ Add song</button>
            </div>
          )}
        </section>

        {/* ── Queue ── */}
        {upNext.length > 0 && (
          <section className="queue-section">
            <div className="section-label">COMING UP</div>
            <div className="queue-list">
              {upNext.map((item, i) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  rank={i + 2}
                  voterToken={voterToken}
                  onVote={handleVote}
                  voting={voting}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Search modal ── */}
      {showSearch && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowSearch(false); setSearch(""); setResults([]); }}}>
          <div className="modal">
            <button className="modal-close" onClick={() => { setShowSearch(false); setSearch(""); setResults([]); }}>✕</button>
            <h2 className="modal-title">Search a song</h2>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                ref={searchRef}
                className="search-input"
                placeholder="Artist, song, or album…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {searching && <span className="spinner" />}
            </div>
            {searchErr && <p className="search-err">{searchErr}</p>}
            <div className="results-list">
              {results.map(song => (
                <SearchResult
                  key={song.videoId}
                  song={song}
                  inQueue={queue.some(q => q.videoId === song.videoId)}
                  onAdd={handleAdd}
                  adding={adding}
                />
              ))}
              {!searching && search && results.length === 0 && !searchErr && (
                <p className="no-results">No results found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>{toast.msg}</div>}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function NowCard({ song, voterToken, onVote, voting }) {
  const hasVoted = song.voters?.includes(voterToken);
  const isVoting = voting === song.id;
  return (
    <div className="now-card">
      <div className="now-thumb-wrap">
        {song.thumbnail && <img className="now-thumb" src={song.thumbnail} alt="" />}
        <div className="now-thumb-overlay" />
        <a
          className="yt-link"
          href={`https://music.youtube.com/watch?v=${song.videoId}`}
          target="_blank"
          rel="noreferrer"
          title="Open in YouTube Music"
        >▶ YT Music</a>
      </div>
      <div className="now-info">
        <p className="now-title">{song.title}</p>
        <p className="now-artist">{song.artist}</p>
        {song.duration && <p className="now-duration">{song.duration}</p>}
        <div className="vote-row">
          <button
            className={`vote-btn big ${hasVoted ? "voted" : ""}`}
            onClick={() => onVote(song)}
            disabled={isVoting}
          >
            {isVoting ? "…" : hasVoted ? "▲ Voted" : "▲ Vote"}
          </button>
          <span className="vote-count">{song.votes} vote{song.votes !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

function QueueRow({ item, rank, voterToken, onVote, voting }) {
  const hasVoted = item.voters?.includes(voterToken);
  const isVoting = voting === item.id;
  return (
    <div className="queue-row">
      <span className="rank">#{rank}</span>
      {item.thumbnail && <img className="row-thumb" src={item.thumbnail} alt="" />}
      <div className="row-info">
        <p className="row-title">{item.title}</p>
        <p className="row-artist">{item.artist}{item.duration ? ` · ${item.duration}` : ""}</p>
      </div>
      <div className="row-vote">
        <button
          className={`vote-btn sm ${hasVoted ? "voted" : ""}`}
          onClick={() => onVote(item)}
          disabled={isVoting}
        >
          {isVoting ? "…" : hasVoted ? "▲" : "▲"}
        </button>
        <span className="vote-count sm">{item.votes}</span>
      </div>
    </div>
  );
}

function SearchResult({ song, inQueue, onAdd, adding }) {
  const isAdding = adding === song.videoId;
  return (
    <div className="result-row">
      {song.thumbnail && <img className="result-thumb" src={song.thumbnail} alt="" />}
      <div className="result-info">
        <p className="result-title">{song.title}</p>
        <p className="result-artist">{song.artist}{song.duration ? ` · ${song.duration}` : ""}</p>
      </div>
      <button
        className={`add-song-btn ${inQueue ? "in-queue" : ""}`}
        onClick={() => !inQueue && onAdd(song)}
        disabled={isAdding || inQueue}
      >
        {isAdding ? "…" : inQueue ? "✓ Queued" : "+ Add"}
      </button>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = `
  .orb { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(90px); }
  .orb1 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%); top: -150px; left: -100px; }
  .orb2 { width: 400px; height: 400px; background: radial-gradient(circle, rgba(34,211,165,0.12) 0%, transparent 70%); bottom: -100px; right: -80px; }

  .layout { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; }

  /* Header */
  .header { text-align: center; margin-bottom: 48px; }
  .logo { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
  .logo-icon { font-size: 28px; color: var(--accent2); filter: drop-shadow(0 0 8px var(--accent-glow)); }
  .logo-text { font-size: 36px; font-weight: 800; letter-spacing: 0.15em; background: linear-gradient(135deg, #a855f7, #7c3aed, #22d3a5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .tagline { color: var(--muted); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 24px; }

  /* Buttons */
  .add-btn { background: linear-gradient(135deg, var(--accent), var(--accent2)); border: none; color: white; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 10px; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 0 20px var(--accent-glow); }
  .add-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 30px var(--accent-glow); }
  .add-btn.sm { font-size: 13px; padding: 9px 20px; }

  /* Section labels */
  .section-label { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 12px; }

  /* Now playing card */
  .now-section { margin-bottom: 40px; }
  .now-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; gap: 0; box-shadow: 0 0 40px rgba(124,58,237,0.1); }
  .now-thumb-wrap { position: relative; width: 180px; min-width: 180px; height: 140px; overflow: hidden; }
  .now-thumb { width: 100%; height: 100%; object-fit: cover; }
  .now-thumb-overlay { position: absolute; inset: 0; background: linear-gradient(90deg, transparent 60%, var(--surface)); }
  .yt-link { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #ff4444; font-family: 'DM Mono', monospace; font-size: 10px; text-decoration: none; padding: 3px 7px; border-radius: 4px; backdrop-filter: blur(4px); transition: background 0.15s; }
  .yt-link:hover { background: rgba(255,68,68,0.2); }
  .now-info { padding: 20px 24px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .now-title { font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 4px; line-height: 1.3; }
  .now-artist { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .now-duration { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); margin-bottom: 14px; }
  .vote-row { display: flex; align-items: center; gap: 14px; }
  .vote-count { font-family: 'DM Mono', monospace; font-size: 14px; color: var(--muted); }
  .vote-count.sm { font-size: 12px; }

  /* Vote button */
  .vote-btn { border: 2px solid var(--border); background: transparent; color: var(--muted); font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
  .vote-btn:hover:not(:disabled) { border-color: var(--accent2); color: var(--accent2); box-shadow: 0 0 12px var(--accent-glow); }
  .vote-btn.voted { border-color: var(--green); color: var(--green); box-shadow: 0 0 12px var(--green-glow); }
  .vote-btn.big { font-size: 14px; padding: 10px 22px; }
  .vote-btn.sm { padding: 5px 10px; font-size: 12px; }
  .vote-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Empty card */
  .empty-card { background: var(--surface); border: 1px dashed var(--border); border-radius: 16px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .empty-icon { font-size: 36px; color: var(--muted); }
  .empty-card p { color: var(--muted); font-size: 14px; }

  /* Queue */
  .queue-section { }
  .queue-list { display: flex; flex-direction: column; gap: 8px; }
  .queue-row { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; transition: border-color 0.15s; }
  .queue-row:hover { border-color: var(--accent); }
  .rank { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); min-width: 28px; }
  .row-thumb { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .row-info { flex: 1; min-width: 0; }
  .row-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-artist { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-vote { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding-top: 8vh; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; width: 100%; max-width: 560px; max-height: 80vh; overflow-y: auto; padding: 32px 28px; position: relative; }
  .modal-close { position: absolute; top: 16px; right: 16px; background: var(--surface2); border: none; color: var(--muted); font-size: 14px; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .modal-close:hover { color: var(--text); }
  .modal-title { font-size: 22px; font-weight: 800; margin-bottom: 20px; }

  /* Search */
  .search-wrap { position: relative; display: flex; align-items: center; margin-bottom: 20px; }
  .search-icon { position: absolute; left: 14px; font-size: 14px; pointer-events: none; }
  .search-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: 'Syne', sans-serif; font-size: 15px; padding: 13px 14px 13px 40px; border-radius: 10px; outline: none; transition: border-color 0.15s; }
  .search-input:focus { border-color: var(--accent2); }
  .search-input::placeholder { color: var(--muted); }
  .spinner { position: absolute; right: 14px; width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent2); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .search-err { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
  .no-results { color: var(--muted); font-size: 13px; text-align: center; padding: 24px 0; }

  /* Search results */
  .results-list { display: flex; flex-direction: column; gap: 8px; }
  .result-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; border: 1px solid transparent; transition: border-color 0.12s, background 0.12s; }
  .result-row:hover { background: var(--surface2); border-color: var(--border); }
  .result-thumb { width: 52px; height: 52px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
  .result-info { flex: 1; min-width: 0; }
  .result-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .result-artist { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .add-song-btn { background: var(--accent); border: none; color: white; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; padding: 7px 14px; border-radius: 7px; cursor: pointer; white-space: nowrap; transition: background 0.15s; flex-shrink: 0; }
  .add-song-btn:hover:not(:disabled) { background: var(--accent2); }
  .add-song-btn.in-queue { background: var(--surface2); color: var(--muted); cursor: default; border: 1px solid var(--border); }
  .add-song-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Toast */
  .toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--green); color: var(--green); font-family: 'DM Mono', monospace; font-size: 13px; padding: 10px 22px; border-radius: 999px; box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 0 16px var(--green-glow); z-index: 200; animation: slideUp 0.25s ease; white-space: nowrap; }
  .toast.toast-err { border-color: var(--danger); color: var(--danger); box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
  @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* Mobile */
  @media (max-width: 520px) {
    .now-thumb-wrap { width: 110px; min-width: 110px; height: 100px; }
    .now-title { font-size: 14px; }
    .modal { border-radius: 16px; padding: 24px 16px; }
    .logo-text { font-size: 28px; }
  }
`;

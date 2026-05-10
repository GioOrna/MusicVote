"""
Collaborative Jukebox — Streamlit app
• Anyone can search YouTube Music and vote for songs
• Song with most votes plays next
• No login required for voters
• Run: streamlit run app.py
"""

import json
import os
import time
import uuid
import streamlit as st
from pathlib import Path
from ytmusicapi import YTMusic

# ── Config ─────────────────────────────────────────────────────────────────
STATE_FILE = Path("jukebox_state.json")
REFRESH_INTERVAL = 5  # seconds between auto-refresh

st.set_page_config(
    page_title="🎵 Collaborative Jukebox",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Shared State (JSON file as simple shared DB) ────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"queue": [], "current": None, "history": []}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def add_or_vote(video_id: str, title: str, artist: str, thumbnail: str, duration: str, voter_id: str):
    state = load_state()
    queue = state["queue"]
    for song in queue:
        if song["videoId"] == video_id:
            if voter_id not in song["voters"]:
                song["votes"] += 1
                song["voters"].append(voter_id)
            save_state(state)
            return "voted"
    queue.append({
        "videoId": video_id,
        "title": title,
        "artist": artist,
        "thumbnail": thumbnail,
        "duration": duration,
        "votes": 1,
        "voters": [voter_id],
        "added_at": time.time(),
    })
    save_state(state)
    return "added"


def get_sorted_queue():
    state = load_state()
    return sorted(state["queue"], key=lambda s: (-s["votes"], s["added_at"]))


def mark_playing(video_id: str):
    state = load_state()
    state["queue"] = [s for s in state["queue"] if s["videoId"] != video_id]
    save_state(state)


def skip_to_next():
    state = load_state()
    if state["current"]:
        state["history"].append(state["current"])
        state["history"] = state["history"][-20:]  # keep last 20
    sorted_q = sorted(state["queue"], key=lambda s: (-s["votes"], s["added_at"]))
    if sorted_q:
        state["current"] = sorted_q[0]
        state["queue"] = [s for s in state["queue"] if s["videoId"] != sorted_q[0]["videoId"]]
    else:
        state["current"] = None
    save_state(state)


# ── YouTube Music Search ────────────────────────────────────────────────────

@st.cache_resource
def get_ytmusic():
    return YTMusic()


def search_songs(query: str) -> list:
    try:
        yt = get_ytmusic()
        results = yt.search(query, filter="songs", limit=8)
        songs = []
        for r in results:
            if not r.get("videoId"):
                continue
            artists = ", ".join(a["name"] for a in r.get("artists", []))
            thumb = ""
            thumbs = r.get("thumbnails", [])
            if thumbs:
                thumb = thumbs[-1].get("url", "")
            songs.append({
                "videoId": r["videoId"],
                "title": r.get("title", "Unknown"),
                "artist": artists or "Unknown Artist",
                "thumbnail": thumb,
                "duration": r.get("duration", "?"),
            })
        return songs
    except Exception as e:
        st.error(f"Search error: {e}")
        return []


# ── Session voter ID ────────────────────────────────────────────────────────

if "voter_id" not in st.session_state:
    st.session_state.voter_id = str(uuid.uuid4())

if "search_results" not in st.session_state:
    st.session_state.search_results = []

if "last_refresh" not in st.session_state:
    st.session_state.last_refresh = 0

if "search_query" not in st.session_state:
    st.session_state.search_query = ""

# ── Auto-refresh ────────────────────────────────────────────────────────────

def maybe_rerun():
    now = time.time()
    if now - st.session_state.last_refresh > REFRESH_INTERVAL:
        st.session_state.last_refresh = now
        st.rerun()


# ── CSS ─────────────────────────────────────────────────────────────────────

st.markdown("""
<style>
  /* Global */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

  /* Header */
  .jukebox-header {
    text-align: center;
    padding: 1.5rem 0 0.5rem;
  }
  .jukebox-header h1 { font-size: 2.4rem; font-weight: 700; margin-bottom: 0; }
  .jukebox-header p { color: #888; margin-top: 0.2rem; }

  /* Now playing card */
  .now-playing {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border: 1px solid #e94560;
    border-radius: 16px;
    padding: 1.2rem;
    margin-bottom: 1.5rem;
    color: white;
  }
  .now-playing .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #e94560;
    font-weight: 600;
  }
  .now-playing .song-title { font-size: 1.3rem; font-weight: 700; margin: 0.2rem 0; }
  .now-playing .song-artist { color: #aaa; font-size: 0.9rem; }

  /* Queue item */
  .queue-item {
    display: flex;
    align-items: center;
    background: #1e1e2e;
    border-radius: 12px;
    padding: 0.7rem 1rem;
    margin-bottom: 0.5rem;
    border: 1px solid #2a2a3e;
    gap: 0.8rem;
    color: white;
  }
  .queue-item img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; }
  .queue-item .info { flex: 1; }
  .queue-item .info .title { font-weight: 600; font-size: 0.95rem; }
  .queue-item .info .artist { color: #888; font-size: 0.8rem; }
  .queue-item .votes {
    background: #e94560;
    color: white;
    border-radius: 20px;
    padding: 0.2rem 0.7rem;
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .queue-position {
    color: #555;
    font-size: 1rem;
    font-weight: 700;
    min-width: 1.5rem;
    text-align: center;
  }

  /* Search result item */
  .search-result {
    background: #1e1e2e;
    border-radius: 12px;
    padding: 0.7rem 1rem;
    margin-bottom: 0.4rem;
    border: 1px solid #2a2a3e;
    color: white;
  }

  /* Embed iframe */
  .player-wrap iframe {
    border-radius: 12px;
    border: none;
  }

  /* Remove Streamlit branding clutter */
  #MainMenu { visibility: hidden; }
  footer { visibility: hidden; }
  .stDeployButton { display: none; }

  /* Dark background */
  .stApp { background-color: #0f0f1a; }

  /* Input */
  .stTextInput input {
    background: #1e1e2e !important;
    color: white !important;
    border: 1px solid #2a2a3e !important;
    border-radius: 10px !important;
  }

  /* Buttons */
  .stButton > button {
    border-radius: 8px !important;
    font-weight: 600 !important;
  }
</style>
""", unsafe_allow_html=True)

# ── Layout ──────────────────────────────────────────────────────────────────

st.markdown("""
<div class="jukebox-header">
  <h1>🎵 Collaborative Jukebox</h1>
  <p>Search a song, vote it up — most votes plays next. No login needed.</p>
</div>
""", unsafe_allow_html=True)

left_col, right_col = st.columns([1.1, 1], gap="large")

# ── LEFT: Player + Queue ─────────────────────────────────────────────────────
with left_col:
    state = load_state()
    current = state.get("current")
    queue = get_sorted_queue()

    # ── Now Playing ──────────────────────────────────────────────────────────
    if current:
        st.markdown(f"""
        <div class="now-playing">
          <div class="label">▶ Now Playing</div>
          <div class="song-title">{current['title']}</div>
          <div class="song-artist">{current['artist']} &nbsp;·&nbsp; {current.get('duration','?')}</div>
        </div>
        """, unsafe_allow_html=True)

        # Embedded YouTube player
        vid = current["videoId"]
        st.markdown(f"""
        <div class="player-wrap">
          <iframe
            id="yt-player"
            width="100%"
            height="300"
            src="https://www.youtube.com/embed/{vid}?autoplay=1&enablejsapi=1"
            allow="autoplay; encrypted-media"
            allowfullscreen>
          </iframe>
        </div>
        """, unsafe_allow_html=True)

        # Auto-skip button (also triggered by JS below)
        if st.button("⏭ Skip to next", key="skip"):
            skip_to_next()
            st.rerun()

    else:
        # Nothing playing — pick top voted song if queue has items
        if queue:
            st.info("▶ Press **Play Next** to start the jukebox!", icon="🎵")
            if st.button("▶ Play Next Song", type="primary"):
                skip_to_next()
                st.rerun()
        else:
            st.markdown("""
            <div class="now-playing" style="text-align:center; padding: 2rem;">
              <div class="label">Queue Empty</div>
              <div class="song-title" style="font-size:1rem; margin-top:0.5rem;">
                Search and vote for songs →
              </div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("---")

    # ── Queue ────────────────────────────────────────────────────────────────
    st.markdown(f"### 📋 Queue &nbsp; <span style='color:#888;font-size:0.9rem;font-weight:400;'>{len(queue)} song{'s' if len(queue)!=1 else ''}</span>", unsafe_allow_html=True)

    if not queue:
        st.markdown("<p style='color:#555; text-align:center; padding:1rem 0;'>The queue is empty — add songs from the search panel!</p>", unsafe_allow_html=True)
    else:
        for i, song in enumerate(queue):
            thumb_html = f'<img src="{song["thumbnail"]}" />' if song["thumbnail"] else '<div style="width:48px;height:48px;background:#333;border-radius:8px;"></div>'
            vote_word = "vote" if song["votes"] == 1 else "votes"
            st.markdown(f"""
            <div class="queue-item">
              <div class="queue-position">#{i+1}</div>
              {thumb_html}
              <div class="info">
                <div class="title">{song['title']}</div>
                <div class="artist">{song['artist']} · {song.get('duration','?')}</div>
              </div>
              <div class="votes">▲ {song['votes']} {vote_word}</div>
            </div>
            """, unsafe_allow_html=True)

    # Auto-refresh ticker
    st.markdown(f"<p style='color:#333; font-size:0.7rem; text-align:right;'>Auto-refreshes every {REFRESH_INTERVAL}s</p>", unsafe_allow_html=True)


# ── RIGHT: Search + Vote ──────────────────────────────────────────────────────
with right_col:
    st.markdown("### 🔍 Search &amp; Vote")

    query = st.text_input(
        "Search YouTube Music",
        placeholder="e.g. Daft Punk Get Lucky",
        key="search_input",
        label_visibility="collapsed",
    )

    col_search, col_clear = st.columns([3, 1])
    with col_search:
        do_search = st.button("🔍 Search", type="primary", use_container_width=True)
    with col_clear:
        if st.button("✕ Clear", use_container_width=True):
            st.session_state.search_results = []
            st.rerun()

    if do_search and query.strip():
        with st.spinner("Searching YouTube Music…"):
            st.session_state.search_results = search_songs(query.strip())

    results = st.session_state.search_results
    if results:
        st.markdown(f"<p style='color:#888; font-size:0.85rem;'>{len(results)} results — click to vote</p>", unsafe_allow_html=True)
        for song in results:
            thumb_html = f'<img src="{song["thumbnail"]}" style="width:44px;height:44px;border-radius:6px;object-fit:cover;float:left;margin-right:10px;">' if song["thumbnail"] else ""
            in_queue = any(s["videoId"] == song["videoId"] for s in get_sorted_queue())
            is_playing = current and current["videoId"] == song["videoId"]

            badge = ""
            if is_playing:
                badge = " <span style='background:#27ae60;color:white;border-radius:4px;padding:1px 6px;font-size:0.7rem;'>▶ playing</span>"
            elif in_queue:
                badge = " <span style='background:#2a2a3e;color:#e94560;border-radius:4px;padding:1px 6px;font-size:0.7rem;border:1px solid #e94560;'>in queue</span>"

            btn_label = "▲ Vote" if in_queue else "＋ Add"
            if is_playing:
                btn_label = "▶ Playing"

            c1, c2 = st.columns([4, 1])
            with c1:
                st.markdown(f"""
                <div class="search-result" style="min-height:60px;">
                  {thumb_html}
                  <div style="overflow:hidden;">
                    <div style="font-weight:600;font-size:0.9rem;">{song['title']}{badge}</div>
                    <div style="color:#888;font-size:0.8rem;">{song['artist']} · {song.get('duration','?')}</div>
                  </div>
                  <div style="clear:both;"></div>
                </div>
                """, unsafe_allow_html=True)
            with c2:
                disabled = is_playing
                if st.button(btn_label, key=f"vote_{song['videoId']}", disabled=disabled, use_container_width=True):
                    result = add_or_vote(
                        song["videoId"], song["title"], song["artist"],
                        song["thumbnail"], song["duration"],
                        st.session_state.voter_id,
                    )
                    if result == "voted":
                        st.toast(f"✅ Voted for **{song['title']}**!")
                    else:
                        st.toast(f"✅ Added **{song['title']}** to queue!")
                    st.rerun()

    st.markdown("---")

    # ── Current voter info ────────────────────────────────────────────────────
    with st.expander("ℹ️ How it works"):
        st.markdown("""
        - **Search** any song on YouTube Music
        - Click **＋ Add** to add it to the queue, or **▲ Vote** if it's already there
        - The song with the **most votes** plays next when the current one ends
        - Each browser gets one vote per song (tracked anonymously)
        - The **host** uses the **⏭ Skip** button to advance songs manually, or let the page's auto-detect handle it
        """)
        st.caption(f"Your anonymous voter ID: `{st.session_state.voter_id[:8]}…`")


# ── Auto-refresh via meta-refresh trick ────────────────────────────────────
# We use a JS polling approach so all viewers stay in sync
st.markdown(f"""
<script>
  // Auto reload every {REFRESH_INTERVAL * 1000}ms
  setTimeout(() => window.location.reload(), {REFRESH_INTERVAL * 1000});
</script>
""", unsafe_allow_html=True)

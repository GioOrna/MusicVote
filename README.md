# 🎵 Collaborative Jukebox

A Streamlit app where multiple people can vote on what YouTube Music song plays next — no login required for voters.

## Features

- 🔍 **Search** any song on YouTube Music
- 👍 **Vote** — song with most votes plays next
- 🎵 **Embedded player** right in the browser
- 🔄 **Auto-refreshes** every 5 seconds so all users see live updates
- 🕶️ **No login needed** for voters — each browser gets an anonymous ID
- 📋 **Live queue** sorted by votes in real time

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the app

```bash
streamlit run app.py
```

### 3. Share the URL

Once running, share the local URL (e.g. `http://192.168.1.x:8501`) with everyone on your network. For public access, deploy to Streamlit Community Cloud (free) or any server.

## How the queue works

- Anyone can search a song and add it / vote for it
- The queue is sorted by **votes** (ties broken by who was added first)
- The **host** (person running the app) controls playback:
  - Click **▶ Play Next Song** to start
  - Click **⏭ Skip** to advance to the next song
- The embedded YouTube player autoplays each song

## Deployment (public access)

To let people join from anywhere:

### Streamlit Community Cloud (free, easiest)
1. Push this folder to a GitHub repo
2. Go to https://share.streamlit.io and connect your repo
3. Share the generated URL

### Local network (party/event)
Just run `streamlit run app.py --server.address 0.0.0.0` and share your machine's local IP.

## Notes

- `jukebox_state.json` is auto-created and stores the queue. Delete it to reset.
- `ytmusicapi` searches YouTube Music without requiring an account for search.
- Each person's vote is tracked by a browser-session UUID (anonymous, resets on browser close).

# Pass the Boom

A mobile-first **hot-potato chase** party game. One player holds the Boom. They chase and **tag** someone to pass it. If the fuse runs out while you hold it, you soft-explode (funny “out”, no gore) and the Boom jumps to a random survivor. Last player standing wins.

**Not** Among Us, **not** Pictionary, **no** voting — just chase and tag.

Play (once published): https://mati-sme.github.io/pass-the-boom/

## How to play

1. Open the game on two or more phones (or two browser tabs).
2. One person taps **Create room** → shares the **4-letter room code**.
3. Others tap **Join room**, enter the code and their name.
4. Host toggles **Kids Mode** (longer fuse) if needed, then **Start match**.
5. Drag anywhere on the map for an **invisible floating joystick** (WASD / arrows on desktop).
6. If you have the Boom (orange bomb over your head + big badge), chase and bump into someone to pass it. Fuse resets on every pass.
7. Fuse hits zero → soft boom → you’re out. Continues until one player remains → **Play again**.

Ages: designed for mixed groups (about 4yo–teens). Big tap targets, clear Boom indicator, Kids Mode fuse.

## Run locally

Static files only — no build step.

```bash
cd /workspace/projects/pass-the-boom   # or your clone
python3 -m http.server 8080
```

Open `http://localhost:8080` in two tabs. (ES modules need a real origin, so don’t open `index.html` as a `file://` URL.)

## Publish to GitHub Pages

```bash
# from this folder, after creating the empty repo mati-sme/pass-the-boom
git init
git add .
git commit -m "Initial Pass the Boom scaffold"
git branch -M main
git remote add origin https://github.com/mati-sme/pass-the-boom.git
git push -u origin main
gh api -X PUT repos/mati-sme/pass-the-boom/pages -f build_type=workflow 2>/dev/null || true
# Or: GitHub → Settings → Pages → Source: Deploy from branch → main / (root)
```

Live URL: `https://mati-sme.github.io/pass-the-boom/`

After each content change, bump `CACHE` in `sw.js` (e.g. `pass-the-boom-v2`) so phones pick up the new files.

## Networking (v1)

| Piece | Choice |
| --- | --- |
| Transport | **WebRTC data channels** via [PeerJS](https://peerjs.com/) |
| CDN | `https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js` (loaded from `index.html`) |
| Signaling | Free public PeerServer `0.peerjs.com` (host/port/path set in `js/net.js`) |
| Authority | **Host phone** owns fuse, Boom holder, who’s out, and broadcasts snapshots ~20 Hz |
| Room codes | Host registers Peer id `ptb-XXXX`. Joiners connect to that id. |

### Caveats

- The **free PeerJS cloud** is a public signaling service. It can be rate-limited or briefly down. Peers still need working STUN/WebRTC on the local network or internet; some strict carrier NATs may fail.
- **Fallback:** run your own PeerServer (`npm i -g peer`) or point `peerOpts()` in `js/net.js` at another free host (e.g. a self-hosted `peerjs-server` on Fly/Render). Document the new `host` / `port` / `path` / `secure` values there.
- Host must **keep the tab open** — if the host leaves, the room dies (clients get “Host disconnected”).
- No accounts, no backend of our own for v1.

## Files

- `index.html` — screens (home, join, lobby, play, win)
- `style.css` — mobile-first UI
- `js/main.js` — lobby + loop glue
- `js/net.js` — PeerJS room create/join
- `js/game.js` — authoritative sim (movement, tag, fuse, explode)
- `js/input.js` — floating joystick + keyboard
- `js/render.js` — canvas arena
- `js/audio.js` — WebAudio tick / pass / soft boom / win (no audio files)
- `sw.js` — cache-first PWA shell (bump `CACHE` each release)
- `manifest.webmanifest` — installable shortcut

## License

Made for Matias’s party-game shelf. Hand-written scaffold; no paid APIs, no generated image assets.

# Pass the Boom

A mobile-first **hot-potato chase** party game. One player holds the Boom. They chase and **tag** someone to pass it. If the fuse runs out while you hold it, you soft-explode (funny “out”, no gore) and the Boom jumps to a random survivor. Last player standing wins.

**Not** Among Us, **not** Pictionary, **no** voting — just chase and tag.

Play: https://mati-sme.github.io/pass-the-boom/

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
cd /workspace/projects/pass-the-boom
python3 -m http.server 8080
```

Open `http://localhost:8080` in two tabs. For multiplayer you need the PartyKit server running (see below) or a deployed host in `js/config.js`.

Override host for local PartyKit: `http://localhost:8080/?pk=localhost:1999`

## Publish to GitHub Pages

Push to `mati-sme/pass-the-boom` main. After each content change, bump `CACHE` in `sw.js` (currently `pass-the-boom-v2`).

Live URL: `https://mati-sme.github.io/pass-the-boom/`

## Networking (v2 — PartyKit)

| Piece | Choice |
| --- | --- |
| Transport | WebSocket to PartyKit (Cloudflare Durable Object) |
| Authority | **Server** runs fuse / Boom / tags at ~20 Hz — no phone is the host brain |
| Client feel | Local movement prediction + soft reconcile |
| Room codes | Still 4 letters; room id `ptb-XXXX` |
| Host role | Lobby leader only (Kids Mode + Start / Play again) |

Server project: `/workspace/projects/party-games-server/` (shared with Quiet Courier).

Set `PARTYKIT_HOST_DEFAULT` in `js/config.js` after `npx partykit deploy`. Until then Create/Join shows a clear “server not deployed” error.

### Deploy server (one-time)

```bash
cd ../party-games-server
npm install
npx partykit login   # browser device-code login
npx partykit deploy
# → https://party-games.<user>.partykit.dev
# put that host (no https://) into js/config.js
```

## Files

- `index.html` — screens (home, join, lobby, play, win)
- `style.css` — mobile-first UI
- `js/config.js` — PartyKit host
- `js/main.js` — lobby + client loop + prediction
- `js/net.js` — WebSocket room create/join
- `js/game.js` — sim helpers + serialize / predict
- `js/input.js` — floating joystick + keyboard
- `js/render.js` — canvas arena
- `js/audio.js` — WebAudio SFX
- `sw.js` — PWA shell (`pass-the-boom-v2`)

## License

Made for Matias’s party-game shelf. Hand-written; no paid APIs.

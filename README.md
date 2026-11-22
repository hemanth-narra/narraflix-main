# ▶️ Narraflix

A fast, lightweight, personal streaming front-end that embeds content from publicly available third-party sources. Enter any IMDb ID to instantly watch movies and TV shows across multiple streaming providers.

---

## 🚀 Quick Start (Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac) or Docker Engine + Compose (Linux)

### Running on Ubuntu VM / Server
```bash
# Clone/copy files into your server and run:
bash setup.sh
```
This builds the container, binds port `8080`, and sets up auto-start on system boot.

### Running manually on any OS
```bash
# Build and start in background
docker compose up -d --build
```
Open **`http://localhost:8080`** in your browser.

| Command | Description |
|---|---|
| `docker compose up -d --build` | Build and start Narraflix |
| `docker compose down` | Stop container |
| `docker compose logs -f` | View live access logs |

> **Change Port:** Edit `ports:` in `docker-compose.yml` (e.g. `"3000:80"` to serve on port 3000).

---

## 💻 Running Without Docker

Simply open `index.html` directly in any web browser, or serve it with Python/Node:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

---

## 🛡️ Built-in Protections (In `app.js`)

Narraflix includes client-side defenses against annoying ads and malicious redirects:
- **Suppressed `window.open`**: Prevents scripts inside embeds from opening popup tabs in the parent window.
- **Navigation Hijack Protection**: Guards against unexpected `beforeunload` redirects that attempt to steal the active tab.
- **DOM Overlay Cleaner**: Uses a `MutationObserver` to automatically clean up injected fixed-position ad overlays.
- **Permissions Policy**: Limits embed iframe permissions to only `autoplay`, `fullscreen`, and `picture-in-picture`.

---

## 🗂️ Project Structure

```
narraflix-main/
├── index.html          # App shell & disclaimer modal
├── app.js              # Core logic, rendering, navigation & anti-redirect
├── style.css           # Modern dark styling, animations, responsive layout
├── providers.js        # Streaming provider configurations & embed builders
├── health.js           # Server health checking system
├── Dockerfile          # Lightweight nginx:alpine container
├── nginx.conf          # Nginx configuration (gzip, caching, security headers)
├── docker-compose.yml  # Docker Compose config
├── setup.sh            # Auto-setup script for Linux/Ubuntu
└── README.md
```

---

## 🎬 Usage

1. Open Narraflix in your browser (`http://localhost:8080` or your domain).
2. Enter an **IMDb ID** (e.g. `tt1727587` or `tt36915004`).
3. Click **Stream** — the player loads automatically.
4. If a server is slow or buffering, switch to another server on the **Servers** sidebar.
5. For TV series, use the **Season** and **Episode** dropdowns to navigate.

---

## ⚠️ Disclaimer

Narraflix does not host, store, or control any video content. All videos are streamed from publicly available third-party sources at the user's request. Narraflix acts solely as a search and redirect tool and does not promote or endorse any copyrighted material.

This project is intended for **private and educational use only**.

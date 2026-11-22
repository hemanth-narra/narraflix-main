#!/usr/bin/env bash
# =============================================================================
#  Narraflix – One-shot Ubuntu setup
#  Run once: bash setup.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✔]${NC} $*"; }
error()   { echo -e "${RED}[✘]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="narraflix"

echo ""
echo "  🎬  Narraflix – Ubuntu Setup"
echo "  ─────────────────────────────────────────"
echo ""

# ── 1. Check Docker & Compose ────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker is not installed. Install via: curl -fsSL https://get.docker.com | sudo sh"
docker compose version &>/dev/null || error "Docker Compose plugin not found. Run: sudo apt install -y docker-compose-plugin"
info "Docker & Docker Compose are ready"

# ── 2. Build & run container ──────────────────────────────────────────────────
info "Building and starting Narraflix container..."
cd "$SCRIPT_DIR"
docker compose up -d --build
info "Narraflix is running on http://localhost:8080"

# ── 3. Enable auto-start on boot (systemd) ───────────────────────────────────
info "Configuring systemd service for auto-start on boot..."
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Narraflix Streaming Web Service
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}.service"
info "Auto-start enabled"

echo ""
echo -e "  ${GREEN}✅  Narraflix setup complete!${NC}"
echo "  Open http://localhost:8080 in your browser."
echo ""

#!/usr/bin/env bash
# install.sh - Install NexusFlow to /opt/NexusFlow and register the systemd service
#
# Usage:
#   sudo ./install.sh              - Install or upgrade
#   sudo ./install.sh uninstall    - Remove NexusFlow and the service

set -euo pipefail

INSTALL_DIR="/opt/NexusFlow"
BINARY_SRC="./build/NexusFlow"
CONFIG_SRC="./config.json"
SERVICE_SRC="./nexusflow.service"
SERVICE_DEST="/etc/systemd/system/nexusflow.service"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Error: this script must be run as root (use sudo)." >&2
    exit 1
fi

# ── Uninstall ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "uninstall" ]]; then
    echo "Stopping and disabling nexusflow service..."
    systemctl stop nexusflow 2>/dev/null || true
    systemctl disable nexusflow 2>/dev/null || true

    echo "Removing service file..."
    rm -f "${SERVICE_DEST}"
    systemctl daemon-reload

    echo "Removing ${INSTALL_DIR}..."
    rm -rf "${INSTALL_DIR}"

    echo "NexusFlow has been uninstalled."
    exit 0
fi

# ── Install / Upgrade ─────────────────────────────────────────────────────────
if [[ ! -f "${BINARY_SRC}" ]]; then
    echo "Error: binary not found at '${BINARY_SRC}'." >&2
    echo "Run 'cmake --build build -j\$(nproc)' first." >&2
    exit 1
fi

if [[ ! -f "${CONFIG_SRC}" ]]; then
    echo "Error: config file not found at '${CONFIG_SRC}'." >&2
    echo "Create a config.json in the project root first." >&2
    exit 1
fi

echo "Creating install directory: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

echo "Copying binary..."
cp "${BINARY_SRC}" "${INSTALL_DIR}/NexusFlow"
chmod 755 "${INSTALL_DIR}/NexusFlow"

# Only copy config if it does not already exist (avoid overwriting a production config on upgrade)
if [[ ! -f "${INSTALL_DIR}/config.json" ]]; then
    echo "Copying config.json (first install)..."
    cp "${CONFIG_SRC}" "${INSTALL_DIR}/config.json"
    chmod 640 "${INSTALL_DIR}/config.json"
else
    echo "Existing config.json found - skipping copy (edit ${INSTALL_DIR}/config.json manually)."
fi

echo "Installing systemd service..."
cp "${SERVICE_SRC}" "${SERVICE_DEST}"
chmod 644 "${SERVICE_DEST}"

systemctl daemon-reload
systemctl enable nexusflow
systemctl restart nexusflow

echo ""
echo "NexusFlow installed successfully."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status nexusflow   - Check service status"
echo "  sudo journalctl -u nexusflow -f   - Follow live logs"
echo "  sudo systemctl stop nexusflow     - Stop the service"
echo "  sudo systemctl restart nexusflow  - Restart the service"
echo ""
echo "Config file: ${INSTALL_DIR}/config.json"
echo "Binary:      ${INSTALL_DIR}/NexusFlow"

#!/bin/bash
set -e

echo "========================================"
echo "   opentab_ - One-Click Install (Linux)"
echo "========================================"
echo ""

# ── Step 1: Check Python ──
echo "[1/5] Checking Python..."
if command -v python3 &> /dev/null; then
    echo "[OK] $(python3 --version)"
    PYTHON=python3
elif command -v python &> /dev/null; then
    echo "[OK] $(python --version)"
    PYTHON=python
else
    echo "[FAIL] Python is NOT installed."
    echo ""
    echo "Install Python with:"
    echo "  sudo apt install python3 python3-venv"
    exit 1
fi

# ── Step 2: Check Git ──
echo "[2/5] Checking Git..."
if command -v git &> /dev/null; then
    echo "[OK] $(git --version)"
else
    echo "[FAIL] Git is NOT installed."
    echo ""
    echo "Install Git with:"
    echo "  sudo apt install git"
    exit 1
fi

# ── Step 3: Check venv support ──
echo "[3/5] Checking virtual environment support..."
if $PYTHON -m venv --help &> /dev/null; then
    echo "[OK] venv module available."
else
    echo "[FAIL] python3-venv is missing."
    echo ""
    echo "Install it with:"
    echo "  sudo apt install python3-venv"
    exit 1
fi

# ── Step 4: Install / Update opentab in a venv ──
APP_DIR="$HOME/.local/share/opentab"
VENV_DIR="$APP_DIR/venv"
echo "[4/5] Installing opentab..."
echo ""

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment at $VENV_DIR ..."
    $PYTHON -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
"$VENV_DIR/bin/pip" install --upgrade git+https://github.com/steviejrdn/opentab.git
echo "[OK] opentab installed successfully."

# ── Step 5: Create launcher, icon, and menu entry ──
echo ""
echo "[5/5] Creating application launcher..."
BIN_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$BIN_DIR" "$ICON_DIR" "$APPS_DIR"

ICON_PATH=$("$VENV_DIR/bin/python" -c "import opentab, os; print(os.path.join(os.path.dirname(opentab.__file__), 'static', 'opentab_icon.svg'))" 2>/dev/null || echo "")

if [ -n "$ICON_PATH" ] && [ -f "$ICON_PATH" ]; then
    cp "$ICON_PATH" "$ICON_DIR/opentab.svg"
    echo "[OK] App icon installed."
else
    echo "[WARN] Icon file not found. Skipping icon."
fi

cat > "$BIN_DIR/opentab" << EOF
#!/bin/bash
exec "$VENV_DIR/bin/opentab" "\$@"
EOF
chmod +x "$BIN_DIR/opentab"

VERSION=$("$VENV_DIR/bin/python" -c "from importlib.metadata import version; print(version('opentab'))" 2>/dev/null || echo "0.0.0")

cat > "$APPS_DIR/opentab.desktop" << EOF
[Desktop Entry]
Type=Application
Name=opentab
Comment=Survey data cross-tabulation tool
Exec=$VENV_DIR/bin/opentab
Icon=opentab
Terminal=false
Categories=Office;
Version=$VERSION
EOF

if [ -d "$HOME/Desktop" ]; then
    cp "$APPS_DIR/opentab.desktop" "$HOME/Desktop/opentab.desktop"
    chmod +x "$HOME/Desktop/opentab.desktop"
    echo "[OK] Desktop shortcut created."
else
    echo "[INFO] No ~/Desktop folder found. Skipping desktop shortcut."
fi

echo "[OK] Launcher installed: $BIN_DIR/opentab"

# ── Launch ──
echo ""
echo "========================================"
echo "  Launching opentab..."
echo "  Your browser will open automatically."
echo "  Close this window to stop opentab."
echo "========================================"
echo ""
"$VENV_DIR/bin/opentab" --port 8001

#!/bin/bash
set -e

echo "========================================"
echo "   opentab_ - One-Click Install"
echo "========================================"
echo ""

# ── Step 1: Check Python ──
echo "[1/3] Checking Python..."
if command -v python3 &> /dev/null; then
    echo "[OK] $(python3 --version)"
elif command -v python &> /dev/null; then
    echo "[OK] $(python --version)"
    alias python3=python
else
    echo "[FAIL] Python is NOT installed."
    echo ""
    echo "Please download and install Python from:"
    echo "  https://python.org/downloads"
    exit 1
fi

# ── Step 2: Check Git ──
echo "[2/3] Checking Git..."
if command -v git &> /dev/null; then
    echo "[OK] $(git --version)"
else
    echo "[FAIL] Git is NOT installed."
    echo ""
    echo "Install Git with one of these:"
    echo "  • Run: xcode-select --install"
    echo "  • Download: https://git-scm.com/download/mac"
    exit 1
fi

# ── Step 3: Install / Update opentab ──
echo "[3/3] Installing opentab..."
echo ""
pip3 install git+https://github.com/steviejrdn/opentab.git
echo "[OK] opentab installed successfully."

# ── Create .app Bundle ──
echo ""
echo "Creating opentab.app..."
APP_PATH="$HOME/Applications/opentab.app"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"

ICON_PATH=$(python3 -c "import opentab, os; print(os.path.join(os.path.dirname(opentab.__file__), 'static', 'opentab_icon.icns'))" 2>/dev/null || echo "")

if [ -n "$ICON_PATH" ] && [ -f "$ICON_PATH" ]; then
    cp "$ICON_PATH" "$APP_PATH/Contents/Resources/opentab_icon.icns"
    echo "[OK] App icon set."
else
    echo "[WARN] Icon file not found. Skipping icon."
fi

VERSION=$(python3 -c "from importlib.metadata import version; print(version('opentab'))" 2>/dev/null || echo "0.0.0")

cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>opentab</string>
    <key>CFBundleIdentifier</key>
    <string>com.opentab.app</string>
    <key>CFBundleName</key>
    <string>opentab</string>
    <key>CFBundleDisplayName</key>
    <string>opentab</string>
    <key>CFBundleIconFile</key>
    <string>opentab_icon</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
</dict>
</plist>
EOF

cat > "$APP_PATH/Contents/MacOS/opentab" << 'LAUNCHER_EOF'
#!/bin/bash
while true; do
    opentab --port 8001
    sleep 3
done
LAUNCHER_EOF
chmod +x "$APP_PATH/Contents/MacOS/opentab"

echo "[OK] opentab.app created in ~/Applications"

# ── Launch ──
echo ""
echo "========================================"
echo "  Launching opentab..."
echo "  Your browser will open automatically."
echo "  Close this window to stop opentab."
echo "========================================"
echo ""
open "$APP_PATH"

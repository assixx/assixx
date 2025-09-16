#!/bin/bash

# Visual Regression Check Script
# Nimmt Screenshots vor und nach Änderungen und vergleicht sie
# Basiert auf Playwright für Cross-Browser Screenshots

cd /home/scs/projects/Assixx || exit 1

# Konfiguration
SCREENSHOT_DIR="./visual-regression/screenshots"
BASELINE_DIR="$SCREENSHOT_DIR/baseline"
CURRENT_DIR="$SCREENSHOT_DIR/current"
DIFF_DIR="$SCREENSHOT_DIR/diff"
REPORT_FILE="./visual-regression/report.html"

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Erstelle Verzeichnisse
mkdir -p "$BASELINE_DIR" "$CURRENT_DIR" "$DIFF_DIR"

# URLs zum Testen (wichtigste Seiten)
declare -A pages=(
    ["dashboard"]="http://localhost:3000/dashboard"
    ["calendar"]="http://localhost:3000/calendar"
    ["blackboard"]="http://localhost:3000/blackboard"
    ["documents"]="http://localhost:3000/documents"
    ["chat"]="http://localhost:3000/chat"
    ["kvp"]="http://localhost:3000/kvp"
    ["survey-admin"]="http://localhost:3000/survey-admin"
    ["shifts"]="http://localhost:3000/shifts"
    ["profile"]="http://localhost:3000/profile"
    ["admin-dashboard"]="http://localhost:3000/admin-dashboard"
)

# Funktion zum Prüfen ob Playwright installiert ist
check_playwright() {
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}✗ npx nicht gefunden. Bitte Node.js installieren.${NC}"
        exit 1
    fi

    if ! npx playwright --version &> /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Playwright nicht gefunden. Installiere...${NC}"
        npm install -D @playwright/test
        npx playwright install chromium
    fi
}

# Screenshot Funktion
take_screenshot() {
    local url=$1
    local name=$2
    local output_dir=$3

    echo -e "📸 Screenshot: $name..."

    # Playwright Script inline ausführen
    npx playwright test --reporter=dot <<EOF
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    // Login Cookie setzen (anpassen je nach Auth-System)
    await context.addCookies([{
        name: 'token',
        value: '${AUTH_TOKEN:-test-token}',
        domain: 'localhost',
        path: '/'
    }]);

    const page = await context.newPage();

    // Navigate and wait for content
    await page.goto('$url', { waitUntil: 'networkidle' });

    // Warte auf spezifische Elemente
    try {
        await page.waitForSelector('.main-content', { timeout: 5000 });
    } catch (e) {
        console.info('Main content not found, continuing...');
    }

    // Screenshot
    await page.screenshot({
        path: '$output_dir/${name}.png',
        fullPage: true
    });

    await browser.close();
})();
EOF
}

# Hauptfunktion
main() {
    echo "=================================="
    echo "Visual Regression Check"
    echo "=================================="
    echo ""

    # Prüfe Playwright
    check_playwright

    # Parse Command Line Arguments
    case "$1" in
        "baseline")
            echo -e "${GREEN}📷 Erstelle Baseline Screenshots...${NC}"
            for page in "${!pages[@]}"; do
                take_screenshot "${pages[$page]}" "$page" "$BASELINE_DIR"
            done
            echo -e "${GREEN}✓ Baseline Screenshots erstellt!${NC}"
            ;;

        "test")
            echo -e "${YELLOW}🔍 Erstelle Test Screenshots...${NC}"

            # Prüfe ob Baseline existiert
            if [ -z "$(ls -A $BASELINE_DIR 2>/dev/null)" ]; then
                echo -e "${RED}✗ Keine Baseline Screenshots gefunden!${NC}"
                echo "Führe zuerst aus: $0 baseline"
                exit 1
            fi

            # Erstelle aktuelle Screenshots
            for page in "${!pages[@]}"; do
                take_screenshot "${pages[$page]}" "$page" "$CURRENT_DIR"
            done

            # Vergleiche Screenshots
            echo ""
            echo -e "${YELLOW}🔍 Vergleiche Screenshots...${NC}"

            # Installiere ImageMagick wenn nicht vorhanden
            if ! command -v compare &> /dev/null; then
                echo "Installiere ImageMagick für Bildvergleich..."
                sudo apt-get update && sudo apt-get install -y imagemagick
            fi

            # Vergleiche jeden Screenshot
            differences_found=0
            for page in "${!pages[@]}"; do
                baseline="$BASELINE_DIR/${page}.png"
                current="$CURRENT_DIR/${page}.png"
                diff="$DIFF_DIR/${page}-diff.png"

                if [ -f "$baseline" ] && [ -f "$current" ]; then
                    # Vergleiche mit ImageMagick
                    result=$(compare -metric AE "$baseline" "$current" "$diff" 2>&1)

                    if [ "$result" -eq "0" ]; then
                        echo -e "${GREEN}✓${NC} $page: Keine Änderungen"
                    else
                        echo -e "${RED}✗${NC} $page: ${RED}$result Pixel unterschiedlich${NC}"
                        differences_found=$((differences_found + 1))
                    fi
                fi
            done

            # Generiere HTML Report
            generate_report

            if [ $differences_found -eq 0 ]; then
                echo ""
                echo -e "${GREEN}✓ Alle Tests bestanden! Keine visuellen Änderungen gefunden.${NC}"
                exit 0
            else
                echo ""
                echo -e "${RED}✗ $differences_found Seiten haben visuelle Änderungen!${NC}"
                echo -e "Report: ${YELLOW}$REPORT_FILE${NC}"
                exit 1
            fi
            ;;

        "clean")
            echo "🧹 Räume auf..."
            rm -rf "$CURRENT_DIR" "$DIFF_DIR"
            echo -e "${GREEN}✓ Aufgeräumt!${NC}"
            ;;

        "reset")
            echo "🔄 Reset alle Screenshots..."
            rm -rf "$SCREENSHOT_DIR"
            mkdir -p "$BASELINE_DIR" "$CURRENT_DIR" "$DIFF_DIR"
            echo -e "${GREEN}✓ Reset abgeschlossen!${NC}"
            ;;

        *)
            echo "Usage: $0 {baseline|test|clean|reset}"
            echo ""
            echo "  baseline - Erstellt Baseline Screenshots"
            echo "  test     - Erstellt neue Screenshots und vergleicht mit Baseline"
            echo "  clean    - Löscht aktuelle und Diff Screenshots"
            echo "  reset    - Löscht alle Screenshots"
            echo ""
            echo "Workflow:"
            echo "  1. $0 baseline    # Vor Änderungen"
            echo "  2. # Mache deine Code-Änderungen"
            echo "  3. $0 test        # Nach Änderungen"
            exit 1
            ;;
    esac
}

# HTML Report Generator
generate_report() {
    cat > "$REPORT_FILE" <<'EOF'
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Visual Regression Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
        }
        .page-comparison {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .page-name {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .status-pass {
            color: #4caf50;
        }
        .status-fail {
            color: #f44336;
        }
        .images {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .image-container {
            text-align: center;
        }
        .image-container img {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .image-label {
            font-weight: bold;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <h1>Visual Regression Test Report</h1>
    <p>Generated: <script>document.write(new Date().toLocaleString());</script></p>
EOF

    # Füge Vergleiche hinzu
    for page in "${!pages[@]}"; do
        baseline="$BASELINE_DIR/${page}.png"
        current="$CURRENT_DIR/${page}.png"
        diff="$DIFF_DIR/${page}-diff.png"

        if [ -f "$diff" ]; then
            status="status-fail"
            status_text="❌ Änderungen gefunden"
        else
            status="status-pass"
            status_text="✅ Keine Änderungen"
        fi

        cat >> "$REPORT_FILE" <<EOF
    <div class="page-comparison">
        <div class="page-name">
            <span class="$status">$status_text</span> - $page
        </div>
        <div class="images">
            <div class="image-container">
                <div class="image-label">Baseline</div>
                <img src="../screenshots/baseline/${page}.png" alt="Baseline">
            </div>
            <div class="image-container">
                <div class="image-label">Aktuell</div>
                <img src="../screenshots/current/${page}.png" alt="Current">
            </div>
            <div class="image-container">
                <div class="image-label">Unterschiede</div>
                <img src="../screenshots/diff/${page}-diff.png" alt="Diff" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='">
            </div>
        </div>
    </div>
EOF
    done

    echo "</body></html>" >> "$REPORT_FILE"
}

# Führe Hauptfunktion aus
main "$@"

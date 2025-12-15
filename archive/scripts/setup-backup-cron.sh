#!/bin/bash

# Setup Cron für automatische Backups

SCRIPT_PATH="/home/scs/projects/Assixx/backup-database.sh"
CRON_LOG="/home/scs/projects/Assixx/backups/cron.log"

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "   Assixx Backup Cron Setup"
echo "======================================"
echo ""

echo -e "${GREEN}Verfügbare Backup-Zeitpläne:${NC}"
echo ""
echo "  [1] Täglich um 02:00 Uhr"
echo "  [2] Täglich um 23:00 Uhr"
echo "  [3] Alle 6 Stunden (00:00, 06:00, 12:00, 18:00)"
echo "  [4] Alle 12 Stunden (06:00, 18:00)"
echo "  [5] Nur manuell (kein Cron)"
echo ""

read -p "Wählen Sie einen Zeitplan (1-5): " choice

case $choice in
    1)
        CRON_TIME="0 2 * * *"
        DESC="Täglich um 02:00 Uhr"
        ;;
    2)
        CRON_TIME="0 23 * * *"
        DESC="Täglich um 23:00 Uhr"
        ;;
    3)
        CRON_TIME="0 */6 * * *"
        DESC="Alle 6 Stunden"
        ;;
    4)
        CRON_TIME="0 6,18 * * *"
        DESC="Alle 12 Stunden (06:00, 18:00)"
        ;;
    5)
        echo "Kein Cron-Job wird eingerichtet. Sie können Backups manuell ausführen mit:"
        echo "  $SCRIPT_PATH"
        exit 0
        ;;
    *)
        echo "Ungültige Auswahl!"
        exit 1
        ;;
esac

# Erstelle Cron-Job
CRON_JOB="$CRON_TIME $SCRIPT_PATH >> $CRON_LOG 2>&1"

# Prüfe ob Cron-Job bereits existiert
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo -e "${YELLOW}⚠️  Ein Backup-Cron-Job existiert bereits:${NC}"
    crontab -l | grep "$SCRIPT_PATH"
    echo ""
    read -p "Möchten Sie ihn ersetzen? (j/n): " replace
    if [ "$replace" != "j" ]; then
        echo "Abgebrochen."
        exit 0
    fi
    # Entferne alten Job
    crontab -l | grep -v "$SCRIPT_PATH" | crontab -
fi

# Füge neuen Cron-Job hinzu
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo ""
echo -e "${GREEN}✅ Backup-Cron-Job eingerichtet!${NC}"
echo ""
echo "Zeitplan: $DESC"
echo "Cron-Job: $CRON_JOB"
echo ""
echo "Nützliche Befehle:"
echo "  - Cron-Jobs anzeigen: crontab -l"
echo "  - Cron-Jobs bearbeiten: crontab -e"
echo "  - Backup-Log anzeigen: tail -f $CRON_LOG"
echo "  - Manuelles Backup: $SCRIPT_PATH"
echo ""
echo -e "${YELLOW}Hinweis:${NC} Das erste automatische Backup erfolgt zum nächsten geplanten Zeitpunkt."
# Assixx Projekt - Unsere privaten Arbeitsnotizen (Simon & Claude)

## Anweisungen für Claude
1. DIESE CLAUDE.md DATEI IMMER ZUERST LESEN BEI JEDEM START
2. CLAUDE.local.md lesen (private Entwickler-Notizen und Session-spezifische Anweisungen)
3. Git Status prüfen
4. Dann README.md und ROADMAP.md lesen und analysieren
5. Übersicht und Analyse als Zusammenfassung präsentieren
6. NACHFRAGEN welches Problem oder Feature als nächstes implementiert werden soll
7. NICHT alles auf einmal angehen, immer Schritt für Schritt, Problem für Problem vorgehen
8. IMMER nach der Abarbeitung eines Problems oder Features nachfragen, was als nächstes gemacht werden soll
9. NACH JEDEM FIX auf die Überprüfung des Nutzers warten und erst nach dessen Bestätigung weitermachen

## Git-Workflow (AB SOFORT - SEHR WICHTIG!)
- **IMMER Feature-Branches erstellen** - NIE direkt auf master pushen!
- **VOR jedem Commit fragen**: "Soll ich Feature-Branch erstellen?"
- **Branch-Namen vorschlagen**: feature/blackboard-colors, feature/calendar-fix, etc.
- **Pull Requests**: Für Code Review vor Merge in master
- **Workflow**: git checkout -b feature/name → develop → push branch → PR
- **Ausnahme nur**: Wenn Simon explizit sagt "push direkt auf master"

## Projektübersicht
- **Name**: Assixx (SaaS-Plattform für Industriefirmen)
- **Zielgruppe**: Industriefirmen mit Produktionsarbeitern ohne PC-Zugang
- **Business-Modell**: SaaS mit modularen Features (Basic €0, Premium €49, Enterprise €149)
- **Standort**: `/home/scs/projects/Assixx/` (WSL Ubuntu)
- **Repository**: https://github.com/SCS-Technik/Assixx

[... rest of the existing content remains the same ...]

## Simon's Lieblings-Design-System (IMMER SO UMSETZEN!)
**Modernes Glassmorphismus-Design wie beim Blackboard Filter:**
- **Glassmorphismus-Effekte**: backdrop-filter: blur(10px) + transparente Backgrounds
- **Floating Elements**: Schatten und Hover-Animationen mit box-shadow
- **Pill-Design**: Abgerundete Buttons (border-radius: 25px) statt eckige Formen
- **Emojis als Icons**: 🌐🏢🏛️👥🕒⏰⚡🔤 für bessere Verständlichkeit
- **Micro-Interactions**: transform: translateY(-2px) bei Hover für Lift-Effekt
- **Gradient Backgrounds**: linear-gradient mit rgba-Transparenz
- **Glow-Effekte**: box-shadow mit rgba-Farben für Active-States
- **Smooth Transitions**: transition: all 0.3s ease überall

**KEIN Standard-Design mehr - IMMER modernes UI verwenden!**

## Offene Fragen und Klärungsbedarf
- Wir müssen später noch klären ob Admins im Admin Dashboard zu ihrem Employee Dashboard wechseln können oder ob er durch andere Zugangsdaten in sein Employee Dashboard gelangt
- Option hinzufügen: Admins können beim Senden von Nachrichten an Mitarbeiter oder andere Admins auswählen, ob die Nachricht in der Pause oder nach Feierabend gesendet werden soll

[... rest of the existing content remains the same ...]
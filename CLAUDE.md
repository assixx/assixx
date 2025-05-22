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

## AKTUELLE MASTER-STATUS (2025-05-22)

### ✅ VOLLSTÄNDIG IMPLEMENTIERTE SYSTEME (PRODUCTION READY)
1. **Blackboard-System** - 100% implementiert
   - Farb- und Tag-System für Kategorisierung
   - Erweiterte Filter-Funktionen (Priorität, Tags, Farben, Organisationsebene)
   - Glassmorphismus-Design mit modernen UI-Elementen
   - Lesebestätigungsfunktion für wichtige Mitteilungen
   - Priorisierungssystem (niedrig, normal, hoch, kritisch)

2. **Kalender-System** - 100% implementiert  
   - Benutzerdefinierte Farbauswahl für Kalendereinträge
   - FullCalendar Integration mit Event-Display und Tooltips
   - Event-Bearbeitung mit vollständiger Formular-Validierung
   - Automatische Farb-Fallbacks basierend auf Organisationsebenen
   - reminder_time Database-Fehler behoben

3. **E-Mail-Benachrichtigungen** - 100% implementiert
   - Nodemailer Integration mit Templates
   - Queue-System für Massen-E-Mails
   - Unsubscribe-Funktionalität
   - Automatische Benachrichtigungen bei Events

4. **Feature-Management** - 100% implementiert
   - Multi-Tenant Support mit Subdomain-zu-ID Konvertierung
   - Preismodell: Basic (€0), Premium (€49), Enterprise (€149)
   - Feature-Checks in allen kritischen Routen

5. **Dokumenten-Management** - 100% implementiert
   - Upload/Download mit Streaming-Support
   - Berechtigungsprüfung und Download-Counter

6. **Mitarbeiter-Management** - 100% implementiert
   - Vollständige CRUD-Operationen
   - Abteilungen/Teams-Verwaltung
   - Rolle-basierte Berechtigungen

7. **Schichtplanungs-Tool** - 100% implementiert ✅
   - Interaktiver Schichtplaner mit Drag & Drop für Team- und Abteilungsleiter
   - Wöchentliche Schichtplanansicht mit Navigation zwischen Kalenderwochen
   - Validierung verhindert Doppelzuweisungen am selben Tag
   - Multi-Tenant Support mit vollständiger Datenbankintegration
   - Glassmorphismus-Design im Dashboard-Stil
   - Auto-Save Funktionalität für Wochennotizen
   - API-Endpunkte für Schichten, Maschinen und Bereiche
   - Vollständiges Datenbankschema mit 8 Tabellen
   - Context-Selection für Abteilung, Maschine, Teamleiter und Bereich
   - Drei-Schicht-System (Früh, Spät, Nacht) mit visualisierter Zuordnung

8. **KVP-System** - 100% implementiert ✅
   - Kontinuierlicher Verbesserungsprozess mit vollständiger CRUD-Funktionalität
   - Kategorisierte Vorschläge mit Prioritätssystem (niedrig, normal, hoch, kritisch)
   - File-Upload System mit Bildvorschau und sicherem Download
   - Status-Management mit 7 verschiedenen Status und farbiger Visualisierung
   - Employee-Berechtigungen: Eigene Vorschläge erstellen, bearbeiten und löschen
   - Admin-Berechtigungen: Status ändern, archivieren, alle Vorschläge verwalten
   - Modal-System mit Vollbild-Bildansicht und Attachment-Download
   - Status-Historie-Tracking für Audit-Trail
   - Points-System für Gamification (Grundstruktur implementiert)
   - Ultra-modernes Glassmorphismus-Design mit Gradient-Status-Badges
   - Multi-Tenant Support mit vollständiger Datenbankintegration (7 Tabellen)
   - Responsive Design für Desktop und Mobile

### 🔴 PRIORITÄT 1 - NÄCHSTE FEATURES
1. **Chat-Funktion** 💬 **NÄCHSTE PRIORITÄT**
2. **Bestandsmanagement** 📦
3. **Wartungsplanung** 🔧

### Q1 2025 STATUS: ✅ KOMPLETT ABGESCHLOSSEN
- Blackboard-System: 100% ✅
- Kalender-System: 100% ✅  
- E-Mail-Benachrichtigungen: 100% ✅
- Schichtplanungs-Tool: 100% ✅
- KVP-System: 100% ✅

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

## Production File Storage (TODO für später)
**WICHTIG**: Aktuell werden Fotos lokal in `server/uploads/` gespeichert - für Production muss das geändert werden!

**Empfohlene Lösung: AWS S3**
- Tenant-basierte Ordnerstruktur: `bucket/tenantId/kvp/filename`
- Kosten: ~€0.023/GB/Monat + Transfer
- Integration: AWS SDK for Node.js
- Code-Änderungen: `/server/routes/kvp.js` und `/server/models/kvp.js`

**Alternative Optionen:**
- Google Cloud Storage (~€0.020/GB/Monat)
- Cloudinary für Image-Management (~€0.0018/Image)

**Betrifft Module:**
- KVP-System (Verbesserungsvorschläge mit Fotos)
- Dokumenten-Management (bereits implementiert)
- Profil-Bilder (bereits implementiert)
- Zukünftige Features mit File-Uploads

[... rest of the existing content remains the same ...]
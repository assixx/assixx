# 🌳 Git Branch-Strategie für Assixx

> **Erstellt:** 28.01.2025  
> **Zweck:** Strukturierte Entwicklung mit Feature-Branch-Workflow

## 📋 Branch-Typen

### 1. **Haupt-Branches** (Geschützt)
- `master` - Production-ready Code
- `develop` - Integration Branch für Features
- `experimental` - Für experimentelle Änderungen

### 2. **Feature-Branches**
Format: `feature/[feature-name]`
- Für neue Features
- Von `develop` abzweigen
- Nach Fertigstellung in `develop` mergen

### 3. **Bugfix-Branches**
Format: `bugfix/[bug-description]`
- Für nicht-kritische Bugs
- Von `develop` abzweigen

### 4. **Hotfix-Branches**
Format: `hotfix/[critical-issue]`
- Für kritische Production-Bugs
- Von `master` abzweigen
- In `master` UND `develop` mergen

### 5. **Release-Branches**
Format: `release/[version]`
- Für Release-Vorbereitung
- Von `develop` abzweigen

### 6. **Chore-Branches**
Format: `chore/[task-name]`
- Für Wartungsaufgaben (Dependencies, Refactoring)

### 7. **Docs-Branches**
Format: `docs/[documentation-topic]`
- Für Dokumentations-Updates

## 🔄 Workflow

1. **Feature-Entwicklung:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/new-feature
   # Entwicklung...
   git push origin feature/new-feature
   # Pull Request erstellen
   ```

2. **Hotfix:**
   ```bash
   git checkout master
   git pull origin master
   git checkout -b hotfix/critical-bug
   # Fix...
   git push origin hotfix/critical-bug
   # PR zu master UND develop
   ```

## 📊 Aktuelle Branches (Stand: 28.01.2025)

### ✅ Aktiv & Behalten:
- `master` - Haupt-Branch
- `develop` - Entwicklungs-Branch
- `experimental` - Für Tests

### 🗑️ Zu löschen (bereits gemerged):
- `feature/blackboard` - Feature implementiert
- `feature/blackboard-colors-tags` - Gemerged
- `feature/calendar` - Feature implementiert
- `feature/chat` - Ersetzt durch chat-system
- `feature/eslint-prettier-setup` - Gemerged
- `feature/shift-planning` - Feature implementiert

### 🚧 In Arbeit:
- `feature/chat-system` - Chat-Verbesserungen
- `feature/tenant-self-registration` - Tenant-Registrierung

### 📱 Neue Feature-Branches (zu erstellen):
- `feature/survey-tool` - Umfrage-System vervollständigen
- `feature/vacation-management` - Urlaubsverwaltung
- `feature/mobile-pwa` - Progressive Web App
- `feature/stripe-integration` - Payment Integration
- `feature/multi-language` - i18n Support
- `feature/tpm-calendar` - Wartungskalender
- `feature/quality-checklists` - QS-Checklisten
- `bugfix/survey-fixes` - Survey-Tool Bugs
- `chore/security-updates` - Dependencies aktualisieren
- `chore/eslint-warnings` - Code-Qualität
- `docs/api-documentation` - API-Docs

## 🛡️ Branch-Schutzregeln

### Für `master`:
- Require pull request reviews (2 Reviews)
- Dismiss stale reviews
- Require status checks
- No direct pushes
- Include administrators

### Für `develop`:
- Require pull request reviews (1 Review)
- Require status checks
- No force pushes

## 🏷️ Naming Conventions

### DO ✅:
- Lowercase mit Bindestrichen: `feature/user-authentication`
- Beschreibende Namen: `bugfix/login-validation-error`
- Ticket-Nummern wenn vorhanden: `feature/JIRA-123-payment-gateway`

### DON'T ❌:
- Spaces oder Underscores: `feature/user_authentication`
- Zu generisch: `feature/update`
- Persönliche Namen: `feature/simons-branch`

## 🔍 Branch-Bereinigung

Monatlich durchführen:
1. Gemergte Branches löschen
2. Stale Branches (>3 Monate) überprüfen
3. Dependabot-Branches nach Merge löschen

```bash
# Gemergte Branches anzeigen
git branch --merged | grep -v "\*\|master\|develop"

# Remote Branches bereinigen
git remote prune origin
```
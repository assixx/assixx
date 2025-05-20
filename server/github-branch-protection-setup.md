# Optimale GitHub-Schutzeinstellungen für Assixx

Diese Anleitung beschreibt, wie du die optimalen Branch-Schutzeinstellungen für das Assixx-Projekt konfigurierst.

## Ziel der Konfiguration

Die mitgelieferte JSON-Datei `github-branch-protection.json` enthält eine optimierte Konfiguration mit folgenden Schutzmaßnahmen:

1. **Grundlegender Schutz**:
   - Verhinderung von Branch-Löschung
   - Verhinderung von Force-Pushes
   - Verpflichtende Pull Requests für alle Änderungen

2. **Code-Qualität und Review**:
   - Mindestens 1 Review erforderlich
   - Code-Owner (du) muss jeden PR genehmigen
   - Alle Diskussionen müssen aufgelöst sein
   - Neue Pushes erfordern erneute Reviews

3. **Zusätzliche Sicherheit**:
   - Lineare Commit-Historie erzwingen
   - Signierte Commits erforderlich
   - Abhängigkeits-Review für Sicherheitslücken

## Manuelle Einrichtung über die GitHub-Weboberfläche

### Schritt 1: Branch-Schutzregeln öffnen
1. Gehe zu https://github.com/SCS-Technik/Assixx/settings/branches
2. Klicke auf "Add branch protection rule"

### Schritt 2: Basis-Konfiguration
1. **Branch name pattern**: `master`
2. Aktiviere ✓ **Require a pull request before merging**
   - ✓ Require approvals (1)
   - ✓ Dismiss stale pull request approvals when new commits are pushed
   - ✓ Require review from Code Owners
   - ✓ Require conversation resolution before merging

### Schritt 3: Status-Checks und Signatur
1. Aktiviere ✓ **Require status checks to pass before merging**
   - ✓ Require branches to be up to date before merging
   - Bei verfügbaren Checks: "dependency-review" auswählen
2. Aktiviere ✓ **Require signed commits**
3. Aktiviere ✓ **Require linear history**

### Schritt 4: Zugriffseinschränkungen
1. Aktiviere ✓ **Restrict who can push to matching branches**
   - Füge nur dich selbst (SCS-Technik) hinzu
2. Aktiviere ✓ **Allow force pushes** = OFF (nicht aktivieren!)
3. Aktiviere ✓ **Allow deletions** = OFF (nicht aktivieren!)

### Schritt 5: Speichern
Klicke auf "Create" oder "Save changes" unten auf der Seite.

## Einrichtung über die GitHub API (für Fortgeschrittene)

Falls du die GitHub API benutzen möchtest, kannst du die Einstellungen mit folgendem curl-Befehl anwenden:

```bash
curl -X PUT \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -d @github-branch-protection.json \
  https://api.github.com/repos/SCS-Technik/Assixx/branches/master/protection
```

Ersetze `YOUR_GITHUB_TOKEN` durch einen persönlichen Zugriffstoken mit `repo`-Berechtigungen.

## Prüfung der Einstellungen

Nach der Einrichtung solltest du folgende Tests durchführen:

1. Versuche, direkt auf den master-Branch zu pushen (sollte fehlschlagen)
2. Erstelle einen neuen Branch, mache eine Änderung und erstelle einen Pull Request
3. Prüfe, ob der PR eine Genehmigung von dir benötigt
4. Prüfe, ob Commits ohne Signatur abgelehnt werden (falls aktiviert)

## Empfehlung für Entwickler

Teile deinen Entwicklern mit, dass sie:
1. Immer in Feature-Branches arbeiten sollen, nie direkt in master
2. Ihre Commits mit GPG signieren sollten (falls aktiviert)
3. Pull Requests für alle Änderungen erstellen müssen
4. Alle Review-Kommentare auflösen müssen, bevor der Merge möglich ist

---

Diese Einstellungen bieten maximalen Schutz für deinen Code, während sie gleichzeitig einen strukturierten Workflow für die Entwicklung ermöglichen.
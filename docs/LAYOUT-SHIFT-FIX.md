# Layout Shift Fix für Sidebar

## Problem

Seiten mit Sidebar laden erst in voller Breite und springen dann zur korrekten Breite → unschöner "Layout Shift"

## Lösung

Füge dieses Script im `<head>` Tag ein - **VOR allen CSS-Dateien**!

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Seitentitel</title>

    <!-- Critical Layout State - Prevents Layout Shift -->
    <script>
      (function () {
        const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
        const root = document.documentElement;
        root.setAttribute("data-sidebar", sidebarCollapsed ? "collapsed" : "expanded");
        root.style.setProperty("--sidebar-width", sidebarCollapsed ? "60px" : "250px");
        root.style.setProperty("--content-margin", sidebarCollapsed ? "60px" : "250px");
        root.style.setProperty("--grid-columns", sidebarCollapsed ? "4" : "3");
        root.style.setProperty("--widget-columns", sidebarCollapsed ? "5" : "3");
        root.style.setProperty("--card-padding", sidebarCollapsed ? "2rem" : "1.5rem");
      })();
    </script>

    <!-- CSS kommt NACH dem Script -->
    <link rel="stylesheet" href="/styles/main.css" />
  </head>
</html>
```

## Wann einfügen?

- ✅ Seite hat Sidebar → Script einfügen
- ❌ Keine Sidebar → Nicht nötig

## Seiten OHNE Sidebar (Script NICHT nötig)

- login.html
- signup.html
- index.html
- hilfe.html
- villeicht auch noch mehr, bitte prüfen falls nötig

## Bereits erledigt

- admin-dashboard.html ✅
- employee-dashboard.html ✅
- root-dashboard.html ✅

## Alle anderen Seiten brauchen das Script!

Praktisch ALLE anderen HTML-Dateien im Projekt haben eine Sidebar:

- admin-config.html
- admin-profile.html
- archived-employees.html
- blackboard.html
- calendar.html
- chat.html
- departments.html
- document-upload.html
- documents\*.html (alle Varianten)
- employee-documents.html
- employee-profile.html
- feature-management.html
- kvp.html
- logs.html
- manage-admins.html
- manage-department-groups.html
- org-management.html
- profile.html
- root-features.html
- root-profile.html
- salary-documents.html
- shifts.html
- storage-upgrade.html
- survey\*.html (alle Varianten)
- ...und weitere
- villeicht auch noch mehr, bitte prüfen falls nötig

**Faustregel:** Wenn die Seite eingeloggte Benutzer zeigt → braucht das Script!

## Warum Inline?

- Muss VOR CSS-Parsing ausgeführt werden
- Externes Script würde zu spät laden
- 10 Zeilen Copy&Paste > 500 Zeilen Build-Config

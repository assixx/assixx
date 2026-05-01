# Wo liegen Ihre Daten? — Assixx-Architektur (Beta)

> **Stand:** 2026-04-29 · **Phase:** Closed Beta · **Region:** Deutschland
> **Zweck:** Diese Seite ist für Kunden-Gespräche und Datenschutz-Audits gemacht.
> Sie zeigt, wo Daten liegen, wie sie geschützt sind, und was bei einem Ausfall passiert.

---

## Auf einen Blick

| Frage                              | Antwort                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| **Wo liegen meine Daten?**         | Ausschließlich in Deutschland — Rechenzentrum Falkenstein (Sachsen) |
| **Wer ist der Anbieter?**          | Hetzner Online GmbH — deutsche Aktiengesellschaft                   |
| **DSGVO?**                         | AVV (Auftragsverarbeitungsvertrag nach Art. 28) liegt vor           |
| **CLOUD Act / US-Zugriff?**        | Nicht anwendbar — Hetzner ist kein US-Unternehmen                   |
| **Sind Daten verschlüsselt?**      | Ja: bei Übertragung (TLS 1.3) und im Ruhezustand (AES-256)          |
| **Mandantentrennung?**             | Datenbank-seitig erzwungen (PostgreSQL Row Level Security)          |
| **Wiederherstellung bei Ausfall?** | Maximal 4 Stunden, maximal 24 Stunden Datenverlust                  |

---

## 1. System-Architektur — Was läuft wo?

```
                              Internet
                                 |
                                 |  HTTPS / TLS 1.3
                                 |  Alle Daten verschlüsselt unterwegs
                                 v
                ┌─────────────────────────────────────┐
                │  Cloudflare DNS (Wegweiser)         │
                │  beta.assixx.de  ->  Hetzner-IP     │
                │  Hier fließen KEINE Nutzdaten durch │
                └──────────────────┬──────────────────┘
                                   |
  ╔════════════════════════════════v════════════════════════════════╗
  ║   HETZNER RECHENZENTRUM FALKENSTEIN  (Sachsen, Deutschland)     ║
  ║   Hetzner Online GmbH · Deutsche AG · ISO 27001 · DSGVO · AVV   ║
  ║                                                                 ║
  ║   ┌──────────────────────────┐         ┌────────────────────┐   ║
  ║   │  Server (Hetzner CX41)   │         │  Object Storage    │   ║
  ║   │  Ubuntu Linux 24.04 LTS  │         │                    │   ║
  ║   │                          │   S3    │  Bucket "Uploads": │   ║
  ║   │  - Webserver (Nginx)     │ <-----> │   Bilder, PDFs,    │   ║
  ║   │  - Anwendung (Assixx)    │         │   Dokumente        │   ║
  ║   │  - Datenbank (Postgres)  │         │                    │   ║
  ║   │  - Cache  (Redis)        │         │  Bucket "Backups": │   ║
  ║   │                          │  ---->  │   Tägliche DB-     │   ║
  ║   │  Volume (50 GB)          │         │   Sicherungen      │   ║
  ║   │  Datenbank-Daten         │         │                    │   ║
  ║   │                          │         │  Server-seitig     │   ║
  ║   └──────────────────────────┘         │  verschlüsselt     │   ║
  ║                                        └────────────────────┘   ║
  ║                                                                 ║
  ║   Tägliche Server-Snapshots (7 Tage Aufbewahrung)               ║
  ║   Festplatten verschlüsselt · Firewall · SSH nur mit Schlüssel  ║
  ╚═════════════════════════════════════════════════════════════════╝
```

**Drei Erkenntnisse aus diesem Bild:**

1. **Alles in Deutschland.** Vom DNS bis zum Datei-Speicher. Keine Komponente in den USA, keine in Asien.
2. **Server und Speicher sind getrennt.** Der Anwendungs-Server (auf dem die Software läuft) und der Datei-Speicher (auf dem Bilder/Dokumente liegen) sind zwei unabhängige Systeme. Ein Ausfall des einen bedeutet nicht den Ausfall des anderen.
3. **Mehrere Schutzschichten.** Live-Datenbank, tägliche Backups, Server-Snapshots — drei unabhängige Sicherungsstufen.

---

## 2. Wie ein Bild- oder Dokumenten-Upload funktioniert

```
   (1)  Mitarbeiter wählt im Browser ein Foto aus
        |
        v
   ┌─────────────────────┐
   │  Browser            │
   └──────────┬──────────┘
              |  (2)  "Server, wohin darf ich das hochladen?"
              v
       ┌──────────────────────────┐
       │  Anwendungs-Server       │  <-- prüft Berechtigung
       │  (Hetzner)               │  <-- prüft Größe + Datei-Typ
       └──────────┬───────────────┘  <-- signiert "Eintrittskarte"
                  |                       gültig 5 Min, nur DIESE Datei
                  |
                  | (3)  Eintrittskarte zurück an den Browser
                  v
   ┌─────────────────────┐
   │  Browser            │
   └──────────┬──────────┘
              |  (4)  Bild fließt DIREKT zum Speicher
              |       (am Server vorbei = schnell + datensparsam)
              v
   ┌──────────────────────────────────────────┐
   │  Object Storage Bucket                   │
   │  /tenants/{firma-uuid}/dokumente/...     │
   │   ^                                      │
   │   Pfad enthält die Firmen-ID             │
   │   -> andere Firmen können nicht zugreifen│
   └──────────────────────────────────────────┘
```

**Warum dieser Umweg über die "Eintrittskarte"?**

- Der Anwendungs-Server kann **nur signieren, was er auch sehen darf**. Versucht jemand, eine Eintrittskarte für die Daten einer fremden Firma zu erschleichen, lehnt der Server ab — bevor überhaupt ein Byte fließt.
- Die Eintrittskarte **läuft nach 5 Minuten ab**. Auch wenn sie abgefangen würde, ist sie nach kurzer Zeit wertlos.
- Das **Bild selbst geht nie durch dritte Hände**. Nicht Apple, nicht Google, nicht Microsoft. Direkt vom Browser des Mitarbeiters in das Hetzner-Rechenzentrum in Falkenstein.

---

## 3. Backup-Strategie & Wiederherstellung

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  3 unabhängige Sicherheits-Schichten                            │
   └─────────────────────────────────────────────────────────────────┘

   Schicht 1: Datenbank-Backup (jede Nacht um 03:00 Uhr)
   ─────────────────────────────────────────────────────
   ┌──────────────┐    pg_dump     ┌────────────────────────┐
   │ PostgreSQL   │ -------------> │ Object Storage         │
   │ (auf VPS)    │                │ Bucket "Backups"       │
   └──────────────┘                │ 14 Tage täglich        │
                                   │ + 12 Wochen wöchentl.  │
                                   └────────────────────────┘

   Schicht 2: Server-Snapshot (Festplatten-Vollkopie, automatisch)
   ──────────────────────────────────────────────────────────────
   ┌──────────────┐                ┌────────────────────────┐
   │ Komplette    │ -- Snapshot -->│ Hetzner Snapshot-      │
   │ Server-Disk  │  (täglich)     │ Speicher (7 Tage)      │
   └──────────────┘                └────────────────────────┘

   Schicht 3: Object Storage hat eingebaute Replikation
   ────────────────────────────────────────────────────
   Hetzner repliziert jede Datei intern mehrfach.
   Kunden-Hochladungen sind dadurch von vornherein redundant gespeichert.
```

### Was passiert bei einem kompletten Server-Ausfall?

| Schritt | Was geschieht                                          | Dauer          |
| ------- | ------------------------------------------------------ | -------------- |
| 1       | Neuen Server bei Hetzner bestellen                     | ~10 Min        |
| 2       | Software automatisch (über Skripte) installieren       | ~20 Min        |
| 3       | Letzte Datenbank-Sicherung einspielen                  | ~30 Min        |
| 4       | DNS auf neuen Server umstellen                         | ~5 Min         |
|         | **Garantierte maximale Wiederherstellungszeit (RTO):** | **4 Stunden**  |
|         | **Maximaler möglicher Datenverlust (RPO):**            | **24 Stunden** |

**Hinweis:** Diese Werte gelten für die **Beta-Phase**. Für die Produktion (Alpha/RC und später) reduzieren sich diese Zeiten erheblich:

| Phase              | RTO (Wiederherstellung) | RPO (Datenverlust) |
| ------------------ | ----------------------- | ------------------ |
| **Beta** (jetzt)   | <= 4 Stunden            | <= 24 Stunden      |
| **Alpha** (später) | <= 5 Minuten            | <= 1 Minute        |
| **Produktion**     | ~ 0 Sekunden            | ~ 0 Sekunden       |

---

## 4. Datenschutz-Mandantentrennung

Mehrere Firmen nutzen Assixx auf demselben Server. Die Trennung der Daten ist **nicht nur durch unseren Anwendungs-Code** geregelt, sondern auf zwei tieferen Ebenen erzwungen:

```
   ┌──────────────────────────────────────────────────────────────┐
   │  Anwendungs-Code (Software-Logik)                            │
   │     |                                                        │
   │     v                                                        │
   │  Datenbank-Ebene: Row Level Security (PostgreSQL)            │
   │     -> DB selbst weigert sich, Daten falscher Firmen         │
   │        zurückzugeben — auch bei einem Software-Bug           │
   │     |                                                        │
   │     v                                                        │
   │  Datei-Ebene: separater Pfad pro Firma                       │
   │     /tenants/firma-A/...   <- Firma A sieht nur das          │
   │     /tenants/firma-B/...   <- Firma B sieht nur das          │
   └──────────────────────────────────────────────────────────────┘
```

**In der Praxis bedeutet das:** Selbst wenn ein theoretischer Software-Fehler eine falsche Anfrage stellt, blockt die Datenbank-Schicht den Zugriff bevor ein einziges fremdes Byte das Rechenzentrum verlässt.

---

## 5. Was passiert nach der Beta?

| Phase               | Region          | Hosting                           | Was sich ändert                                |
| ------------------- | --------------- | --------------------------------- | ---------------------------------------------- |
| **Beta**            | DE              | Hetzner Falkenstein, 1 Server     | —                                              |
| **Alpha**           | DACH (DE/AT/CH) | Hetzner DE, 2 Server (gespiegelt) | Automatisches Failover, kein Datenverlust      |
| **RC / Produktion** | EU              | Hetzner DE + EU-Standby           | Mehrere Standorte, Hochverfügbarkeit           |
| **International**   | weltweit        | Hetzner + EU-Provider             | DE-Kunden bleiben in DE — explizit zugesichert |

**Zusicherung:** Kunden, die in der Beta gestartet sind, bleiben **dauerhaft in Deutschland gehostet** — auch wenn Assixx später international skaliert.

---

## 6. Verarbeitungsverzeichnis (für Ihre Datenschutz-Dokumentation)

> Pflichtangaben gem. Art. 30 DSGVO — Sie können diesen Block in Ihr Verarbeitungsverzeichnis übernehmen.

| Auftragsverarbeiter                 | Hetzner Online GmbH                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| **Adresse**                         | Industriestr. 25, 91710 Gunzenhausen, Deutschland             |
| **Standort der Verarbeitung**       | Falkenstein (Sachsen) und Nürnberg (Bayern)                   |
| **Zweck**                           | Hosting der Anwendung, Speicherung von Datei-Uploads, Backups |
| **AVV**                             | Vorhanden, nach Art. 28 DSGVO; Kopie auf Anfrage              |
| **Zertifizierungen**                | ISO 27001, ISO 9001, ISO 14001                                |
| **Übermittlung in Drittländer**     | Nein                                                          |
| **Verschlüsselung im Ruhezustand**  | AES-256 (Standard auf Hetzner Object Storage und Volumes)     |
| **Verschlüsselung bei Übertragung** | TLS 1.3                                                       |

---

## 7. Häufig gestellte Fragen

**Sind die Daten in einer "Cloud"?**
Ja, aber in einer **deutschen** Cloud. Hetzner ist ein deutscher Hosting-Anbieter mit deutschen Rechenzentren. Die landläufig negativ assoziierte „US-Cloud" (AWS, Microsoft Azure, Google Cloud) wird **nicht** verwendet.

**Können wir auch eine Vor-Ort-Installation bekommen?**
Aktuell nicht im Beta-Standardpaket. Eine On-Premises-Installation oder ein Hosting auf Ihrer eigenen Infrastruktur ist auf Anfrage und nach individueller Vereinbarung möglich.

**Was, wenn Hetzner ausfällt?**
In Beta: Wartung im Bereich von Stunden, vergleichbar mit Cloud-Anbietern weltweit. In Produktion: Automatischer Failover auf einen zweiten Standort, sodass Sie davon im Idealfall nichts merken.

**Gibt es einen Notfall-Kontakt?**
Ja. Bei einem Ausfall werden Sie aktiv informiert (E-Mail). Ein Status-Dashboard ist in Vorbereitung.

**Können wir unsere Daten exportieren?**
Ja. Ein Daten-Export Ihrer kompletten Firmen-Daten (Datenbank-Inhalte und Dateien) ist auf Knopfdruck möglich (Recht auf Datenübertragbarkeit, Art. 20 DSGVO).

**Was passiert mit unseren Daten, wenn wir Assixx kündigen?**
Vollständige Löschung innerhalb von 30 Tagen nach Kündigung — sowohl in der Datenbank als auch im Datei-Speicher. Auf Wunsch erhalten Sie vorher einen vollständigen Daten-Export.

---

**Stand dieses Dokuments:** 2026-04-29
**Verantwortlich:** SCS-Technik · `info@assixx.com`
**Version der Architektur:** Beta (Closed)

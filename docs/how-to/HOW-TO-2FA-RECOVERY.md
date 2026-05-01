# HOW-TO — 2FA-Recovery (Lost-Mailbox + Lockout-Clear)

> **Scope:** operative Recovery-Pfade für E-Mail-basierte 2FA (ADR-054). Adressiert
> drei Szenarien: (1) User hat keinen Zugriff mehr auf seine Mailbox, (2) User
> hat sich nach 5 Fehlversuchen für 15 min ausgesperrt, (3) ein Tenant hat nur
> einen Root-User und der ist betroffen.
> **Wer das liest:** Tenant-Root-Users, Customer-IT, SCS-Technik-Operations.
> **Bewusste Beschränkung (DD-30):** Minimal-Umfang. Keine Screenshots
> (verfallen mit jedem UI-Refresh), kein Troubleshooting-Tree (V2-Erweiterung
> wenn Support-Tickets dazu zwingen).
> **Referenzen:** [ADR-054](../infrastructure/adr/ADR-054-mandatory-email-2fa.md)
> · [ADR-010](../infrastructure/adr/ADR-010-user-role-assignment-permissions.md)
> Roles & Two-Root-Rule · [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.4 DD-8 / DD-30.

---

## 1. Wichtigster Grundsatz: kein In-App-Recovery

Assixx hat **bewusst kein** Self-Service-Recovery für 2FA (DD-8). Wer sein Login
nicht mehr durchläuft, hat zwei Pfade — beide laufen über **andere Personen**:

| Problem                                | Recovery-Pfad                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mailbox verloren / unerreichbar        | Firmen-IT des Tenants restored die Mailbox. **Assixx greift hier nicht ein** — die Mailbox gehört dem Tenant, nicht uns.                                                                                                        |
| Lockout durch 5 falsche Codes (15 min) | Ein **anderer Root-User** desselben Tenants ruft `POST /users/:id/2fa/clear-lockout` auf (Two-Root-Rule). Beseitigt nur den Lockout — der nächste Login muss trotzdem 2FA durchlaufen.                                          |
| Letzter Root ausgesperrt               | Wenn der Tenant nur einen Root-User hat und der ist betroffen → keine Self-Recovery möglich. SCS-Technik muss via SSH + Doppler-CLI eingreifen (siehe [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.1a). |

**Warum so streng:** B2B-Industrie-SaaS. Kunden sind Firmen mit gemanagter
Corporate-Mailbox-Infrastruktur. Recovery-Codes / SMS-Backup wären zusätzliche
Angriffsflächen ohne Zusatzwert für die Zielgruppe. ADR-054 §"Alternatives
Considered" listet die rejektierten Optionen mit Begründung.

---

## 2. Szenario A — Mailbox verloren / unerreichbar

**Symptom:** User klickt Login → Code wird gemailt → erreicht den User nicht
(Mailbox gelöscht, Account gesperrt, User aus der Firma ausgeschieden, Mail-Server
down, etc.).

**Recovery-Schritte:**

1. **Firmen-IT** des Tenants stellt Zugriff auf die Mailbox wieder her. Kann
   bedeuten:
   - Mailbox aus Backup wiederherstellen
   - Forwarding auf eine vom User noch erreichbare Adresse einrichten
   - Bei ausgeschiedenem User: Mailbox an Nachfolger delegieren, dann
     2FA-Code abfangen lassen
2. **User loggt sich erneut ein.** 2FA-Challenge wird neu ausgestellt; Code
   wird an die jetzt wieder erreichbare Mailbox gesendet.
3. User gibt den Code ein → Login erfolgreich.

**Wichtig:** Assixx-Operations greift hier **nicht** ein. Die Mailbox gehört
dem Tenant, der Mail-Server gehört dem Tenant. Anrufe / Tickets an
SCS-Technik in diesem Szenario werden mit Verweis auf diese Doku
zurückgewiesen.

**Wenn der User die E-Mail-Adresse selbst ändern will** (z.B. von
`alt-name@firma.de` auf `neu-name@firma.de`): das geht **nicht ohne 2FA**.
Der E-Mail-Change-Endpoint (`POST /users/me/email/request-change`) verlangt
einen **Two-Code-Verify** — eine Bestätigung an die ALTE Adresse plus eine
an die NEUE Adresse, beide innerhalb derselben Verify-Session (DD-32 / R15
gegen Session-Hijack). Wer auf die alte Adresse keinen Zugriff mehr hat,
kommt also auch hier nicht weiter — das ist by design (Hijack-Resistenz).
Der Pfad ist dann derselbe wie oben: Firmen-IT muss die alte Mailbox
restored haben, sonst geht der Change nicht durch.

---

## 3. Szenario B — Lockout-Clear-Workflow (Root → anderer Root)

**Symptom:** User hat 5× hintereinander einen falschen Code eingegeben → für
15 Minuten ausgesperrt (`Forbidden` bei jedem weiteren Login-Versuch).

**Recovery durch einen anderen Root-User desselben Tenants** (Two-Root-Rule):

```bash
# 1. Anderer Root loggt sich normal ein (mit eigener 2FA-Verifikation).
#    Der Recovery-Pfad nutzt das normale Login — kein Bypass, keine
#    Sonder-Credentials.

# 2. Token vom Login-Erfolg merken (3-Cookie-Triade access/refresh/role
#    landet automatisch im Browser; für CLI-Recovery via curl: Token
#    aus dem Set-Cookie-Header oder aus DevTools auslesen).

# 3. Die User-ID des ausgesperrten Users ermitteln. Beispiele:
#    - Aus dem Admin-Panel `/manage-employees` oder `/manage-admins`
#    - Direkt aus der DB:
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, email, tenant_id FROM users WHERE email = 'gesperrter-user@tenant.de';"

# 4. Lockout-Clear-Endpoint aufrufen:
curl -X POST http://localhost:3000/api/v2/users/<USER_ID>/2fa/clear-lockout \
  -H "Authorization: Bearer <ROOT_ACCESS_TOKEN>"
# → 200 OK
# → audit_trail-Row geschrieben: (delete, 2fa-lockout, success,
#                                  {clearedBy: rootId, target: userId})
```

**Was der Endpoint macht:**

| Wirkung                                                 | Persistierter State                                   |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Redis-Key `2fa:lock:{userId}` wird gelöscht             | Ausgesperrter User kann sofort wieder Login probieren |
| Redis-Key `2fa:fail-streak:{userId}` wird gelöscht      | Der 24h-Brute-Force-Counter wird zurückgesetzt        |
| Audit-Row im `audit_trail` (mit `clearedBy` + `target`) | Wer hat wann wessen Lockout zurückgesetzt             |

**Was der Endpoint NICHT macht:**

- **Kein 2FA-Bypass.** Der ausgesperrte User muss beim nächsten Login-Versuch
  wieder eine 2FA-Challenge durchlaufen (Code an seine Mailbox, normales
  Verify). `clear-lockout` setzt nur den Lockout-Timer zurück — die
  2FA-Pflicht selbst bleibt unverändert.
- **Keine Token-Issuance.** Der Endpoint mintet keinen Access-Token, schickt
  keinen Code, ändert keine User-Daten ausser den beiden Redis-Keys + dem
  Audit-Eintrag.

### Two-Root-Regel (von wem darf der Endpoint aufgerufen werden?)

| Caller               | Target                             | Erlaubt?                                                   |
| -------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Root A des Tenants T | Root B desselben Tenants T         | ✅ Ja                                                      |
| Root A des Tenants T | Admin / Employee desselben Tenants | ✅ Ja                                                      |
| Root A des Tenants T | sich selbst (Caller = Target)      | ❌ Nein — `403 Forbidden` (Two-Root-Rule, kein Self-Clear) |
| Root A des Tenants T | User eines anderen Tenants T'      | ❌ Nein — Cross-Tenant blockiert (RLS + Guard)             |
| Admin oder Employee  | beliebig                           | ❌ Nein — `403 Forbidden` (Roles-Guard)                    |

**Warum kein Self-Clear:** wenn ein gestohlenes Root-Konto seinen eigenen
Lockout aufheben dürfte, wäre der Lockout wertlos.

---

## 4. Szenario C — Letzter Root ausgesperrt → SCS-Technik-Eingriff

**Symptom:** ein Tenant hat nur **einen** aktiven Root-User, und genau
dieser User ist ausgesperrt oder hat seine Mailbox verloren. Self-Recovery
unmöglich (Two-Root-Rule), Lockout-Clear nicht möglich (kein anderer Root).

**Mitigation (vorbeugend):** **Two-Root-Anforderung.** Jeder Tenant **muss**
mindestens **2 aktive Root-User** halten. Idealerweise:

- Ein Geschäftsführer / IT-Leiter
- Ein Stellvertreter / zweiter IT-Verantwortlicher

Beide mit getrennten Mailboxen — wenn beide auf derselben Mailbox sitzen,
ist die Mailbox-Komponente weiterhin Single-Point-of-Failure.

> **Detection-Query** (für Operations / Customer-Success — kann periodisch
> als Monitoring-Check laufen):
>
> ```sql
> -- Tenants mit nur EINEM aktiven Root-User (als sys_user, BYPASSRLS)
> SELECT t.id, t.subdomain, t.company_name, COUNT(u.id) AS root_count
> FROM tenants t
> JOIN users u ON u.tenant_id = t.id
> WHERE u.role = 'root'
>   AND u.is_active = 1
> GROUP BY t.id, t.subdomain, t.company_name
> HAVING COUNT(u.id) = 1
> ORDER BY t.id;
> ```

**Recovery, wenn es trotzdem passiert:** SCS-Technik-Operations greift via
**SSH + Doppler-CLI** ein (Out-of-Band-Pfade per `FEAT_2FA_EMAIL_MASTERPLAN.md`
§0.1a):

```bash
# 1. SSH zum Production-Server.

# 2. Lockout in Redis manuell löschen (für den betroffenen userId):
docker exec assixx-redis redis-cli -a "$REDIS_PASSWORD" \
  --no-auth-warning DEL "2fa:lock:<USER_ID>" "2fa:fail-streak:<USER_ID>"

# 3. Audit-Row manuell schreiben (Compliance — wer hat was gemacht):
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  INSERT INTO audit_trail (action, resource_type, status, user_id, tenant_id, changes)
  VALUES ('delete', '2fa-lockout', 'success', NULL, <TENANT_ID>,
          '{\"clearedBy\": \"scs-operations-out-of-band\", \"target\": <USER_ID>, \"reason\": \"last-root-self-locked\"}'::jsonb);
"

# 4. User informieren (per Telefon / vereinbartem Out-of-Band-Kanal),
#    dass der Lockout aufgehoben ist und er es erneut versuchen kann.

# 5. POST-INCIDENT: Tenant verpflichtend auf 2-Root-Setup migrieren.
#    Detection-Query oben weiterhin grün halten.
```

**Diese Recovery ist eine letzte Eskalationsstufe.** Sie hinterlässt im
`audit_trail` einen unverkennbaren Marker (`clearedBy: scs-operations-out-of-band`)
und ist **nicht** Teil des regulären Support-Angebots — sie kostet
Operations-Aufwand und triggert eine Post-Incident-Pflicht zum 2-Root-Setup.

---

## 5. Was diese Recovery-Pfade NICHT sind

Damit niemand auf falsche Ideen kommt — die Liste der Anti-Patterns:

| ❌ Falsche Annahme                                                                              | ✅ Realität                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Lockout-Clear hebt 2FA für diesen User auf"                                                    | Nein. 2FA bleibt aktiv. Nur der 15-min-Lockout-Timer wird zurückgesetzt. User durchläuft beim nächsten Login wieder die normale 2FA-Challenge.                                                      |
| „Recovery-Codes / SMS-Backup wären eine Lösung"                                                 | Nein, bewusst nicht implementiert (DD-8). Würden zusätzliche Angriffsflächen öffnen ohne ausreichenden Mehrwert für die B2B-Industrie-Zielgruppe.                                                   |
| „Ich kann den Endpoint von einem anderen Tenant aus aufrufen"                                   | Nein. Cross-Tenant blockiert durch RLS + Permission-Guard. Caller und Target müssen denselben `tenant_id` haben.                                                                                    |
| „Als Root kann ich meinen eigenen Lockout aufheben"                                             | Nein. Two-Root-Rule: Caller ≠ Target. Self-Clear gibt `403 Forbidden`.                                                                                                                              |
| „Admin oder Employee können den Endpoint auch aufrufen"                                         | Nein. `@Roles('root')` Guard blockt. Ausschliesslich Root-Rolle.                                                                                                                                    |
| „Ich kann via Endpoint die E-Mail-Adresse des Users ändern"                                     | Nein. E-Mail-Change ist ein eigener Endpoint mit Two-Code-Verify (DD-32). `clear-lockout` ändert keine User-Daten.                                                                                  |
| „Bei ausgeschiedenem Root-User kann ich seinen Lockout clearen, dann seinen Account übernehmen" | Account-Übernahme funktioniert über die Personal-Management-Pfade (Soft-Delete + neuen Root anlegen, ADR-055). 2FA-Recovery ist nur eine Komponente davon — kein Override für den Personal-Prozess. |

---

## 6. Verwandte Dokumente

- [ADR-054](../infrastructure/adr/ADR-054-mandatory-email-2fa.md) — Mandatory
  Email-Based 2FA (Architektur-Entscheidung, Threat-Model, alle DDs)
- [ADR-010](../infrastructure/adr/ADR-010-user-role-assignment-permissions.md) —
  Roles (Root / Admin / Employee) und Two-Root-Rule-Begründung
- [ADR-055](../infrastructure/adr/ADR-055-root-account-lifecycle-protection.md) —
  Root-Account-Lifecycle-Protection (Cross-Root-Termination,
  Self-Termination-Workflow)
- [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.1a —
  Out-of-Band-Pfade (SSH + Doppler-CLI) für SCS-Technik-Operations
- [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.4 DD-8 / DD-30 —
  Begründung „kein In-App-Recovery" + Minimal-Umfang dieser Doku
- [HOW-TO-DEV-SMTP](./HOW-TO-DEV-SMTP.md) — Mailpit-Setup für
  Dev-Environment-Tests des Recovery-Flows
- [HOW-TO-CREATE-TEST-USER](./HOW-TO-CREATE-TEST-USER.md) — Tenants mit
  2-Root-Setup für Recovery-Smoke-Tests anlegen

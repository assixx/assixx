# 📋 API Design Workshop - Tagesordnung

**Datum:** [Workshop-Datum]  
**Dauer:** 4-6 Stunden  
**Ort:** [Konferenzraum/Online]  
**Moderator:** [Name]

## 📍 Workshop-Ziel

Eine einheitliche, dokumentierte API-Struktur für Assixx etablieren und alle Inkonsistenzen zwischen Tests, Dokumentation und Implementierung beseitigen.

## 👥 Teilnehmer

- [ ] Frontend Lead Developer
- [ ] Backend Lead Developer
- [ ] Product Owner
- [ ] QA/Test Lead
- [ ] DevOps Engineer
- [ ] Optional: CTO/Tech Lead

## ⏰ Zeitplan

### 09:00 - 09:15: Begrüßung & Einführung

- Workshop-Ziele vorstellen
- Agenda durchgehen
- Erwartungen klären
- Tools-Check (Swagger UI, Miro/Whiteboard)

### 09:15 - 10:15: Phase 1 - IST-Analyse (60 Min)

#### 09:15 - 09:45: Swagger UI Review (30 Min)

- **Live-Demo:** http://localhost:3000/api-docs/
- Gemeinsam durch alle Endpoints gehen
- Inkonsistenzen dokumentieren auf Whiteboard
- Fehlende Endpoints identifizieren
- **Output:** Liste aller Probleme

#### 09:45 - 10:15: Test vs Reality Deep Dive (30 Min)

- API-MISMATCHES.md Präsentation
- Diskussion der kritischsten Abweichungen:
  - Calendar: `/calendar` vs `/calendar/events`
  - Chat: `channels` vs `conversations`
  - Validation: `path` vs `field`
- Gründe für Abweichungen klären
- **Output:** Priorisierte Problem-Liste

### 10:15 - 10:30: ☕ Kaffeepause

### 10:30 - 12:00: Phase 2 - API Standards Definition (90 Min)

#### 10:30 - 11:00: REST Best Practices (30 Min)

- **Präsentation:** api-standards-template.md
- Diskussion & Entscheidungen:
  - Naming Conventions (Plural vs Singular)
  - URL-Struktur (Nested vs Flat)
  - HTTP Verben richtig nutzen
  - Versionierung (Header vs URL)

#### 11:00 - 11:30: Response Format Standards (30 Min)

- Einheitliches Success Format
- Error Response Struktur
- Validation Error Format
- Pagination Standards
- **Live-Coding:** Beispiel-Responses

#### 11:30 - 12:00: Best Practice Examples (30 Min)

- **Review:** example-apis.md
- Stripe API Patterns
- GitHub API Patterns
- Was können wir übernehmen?
- **Output:** Finale API Standards

### 12:00 - 13:00: 🍽️ Mittagspause

### 13:00 - 14:30: Phase 3 - Entscheidungen treffen (90 Min)

#### 13:00 - 14:00: Decision Matrix Ausfüllen (60 Min)

- **Tool:** decision-matrix.md
- Für jeden Endpoint entscheiden:
  - Keep as is
  - Deprecate
  - Change (Breaking)
  - Add new
- Impact-Analyse
- Migration Strategy

#### 14:00 - 14:30: Priorisierung (30 Min)

- Critical vs High vs Medium vs Low
- Quick Wins identifizieren
- Dependencies mapping
- **Output:** Priorisierte Roadmap

### 14:30 - 14:45: ☕ Kaffeepause

### 14:45 - 15:45: Phase 4 - Implementation Plan (60 Min)

#### 14:45 - 15:15: Timeline erstellen (30 Min)

- Sprint-Planung
- Ressourcen-Allokation
- Milestones definieren
- Testing-Strategie

#### 15:15 - 15:45: Tooling & Process (30 Min)

- Postman Workspace Setup
- CI/CD Integration planen
- API Documentation Process
- Breaking Change Communication

### 15:45 - 16:00: Wrap-Up & Next Steps

- Action Items zusammenfassen
- Verantwortlichkeiten klären
- Follow-up Meetings planen
- Feedback-Runde

## 📝 Vorbereitung für Teilnehmer

### Technisch

- [ ] Docker läuft lokal
- [ ] Zugriff auf http://localhost:3000/api-docs/
- [ ] Postman installiert
- [ ] Git Repository geklont

### Dokumente lesen

- [ ] API-MISMATCHES.md
- [ ] current-openapi-spec.json
- [ ] Aktuelle Test-Suite durchsehen

### Mental

- [ ] Bereit für konstruktive Diskussionen
- [ ] Offen für Veränderungen
- [ ] Fokus auf langfristige Lösung

## 🎯 Workshop-Regeln

1. **Keine Schuldzuweisungen** - Fokus auf Lösungen
2. **Timeboxing einhalten** - Moderator achtet auf Zeit
3. **Entscheidungen dokumentieren** - Alles wird festgehalten
4. **Parking Lot** - Off-Topic Themen für später
5. **Konsens anstreben** - Bei Uneinigkeit: Product Owner entscheidet

## 📊 Erfolgs-Kriterien

- [ ] Alle API-Inkonsistenzen sind dokumentiert
- [ ] API Standards sind definiert und akzeptiert
- [ ] Decision Matrix ist vollständig ausgefüllt
- [ ] Implementation Timeline steht
- [ ] Alle Teilnehmer kennen ihre nächsten Schritte

## 🔧 Benötigte Tools & Links

- **Swagger UI:** http://localhost:3000/api-docs/
- **Miro/Whiteboard:** [Link]
- **Decision Matrix:** Google Sheets/Excel
- **Postman:** Team Workspace
- **GitHub:** Issues & PRs

## 📋 Follow-Up

- **Tag 1 nach Workshop:** Protokoll versenden
- **Tag 3:** Erste PRs reviewen
- **Woche 1:** Progress Check Meeting
- **Woche 2:** Mid-Sprint Review
- **Woche 4:** Retrospektive

---

**Notizen während des Workshops:**
_[Platz für Live-Notizen]_

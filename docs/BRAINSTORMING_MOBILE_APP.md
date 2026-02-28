# Mobile App — Brainstorming

**Status:** Brainstorming (kein Masterplan)
**Datum:** 2026-02-27
**Tech:** Capacitor + SvelteKit 5
**Repo:** Monorepo (bestehendes pnpm Workspace)

---

## Entscheidungen (fix)

- **Capacitor** wraps bestehende SvelteKit-App in native Shell
- **1:1 Feature-Parität** mit Web-App — plattformübergreifend
- **Android first** — Google Play zuerst, iOS App Store später (kein Mac vorhanden)
- **iOS nachziehen** — wenn MacBook verfügbar
- **Offline-Lesezugriff** — Pflicht. Schreiboperationen (Create/Update/Delete) → später evaluieren
- **Push Notifications** — ja (Capacitor Push Plugin)
- **Biometrie-Login** — ja (Face ID / Fingerprint)
- **NFC/Bluetooth** — nein (kein Use Case aktuell)

---

## Architektur-Überlegungen

### Monorepo-Struktur

```
/frontend          → SvelteKit (Web + Shared Code)
/frontend/mobile   → Capacitor-Projekt (ios/ + android/)
/backend           → NestJS API (unverändert)
/shared            → @assixx/shared Types
```

### Was sich NICHT ändert

- Backend API — bleibt 1:1 identisch
- @assixx/shared — Types werden direkt genutzt
- Design-Tokens — gleiche CSS-Variablen
- Zod-Schemas — gleiche Validierung

### Was sich ändert / dazukommt

- **Capacitor Config** — `capacitor.config.ts` im Frontend
- **Native Plugins** — Camera, Push, Biometrics, StatusBar, SplashScreen, Keyboard
- **Offline-Layer** — Service Worker + IndexedDB für Read-Cache
- **Platform-Detection** — `Capacitor.isNativePlatform()` für bedingte UI
- **Touch-Optimierung** — größere Hit-Targets, Swipe-Gesten
- **Deep Links** — App-URL-Schema für Benachrichtigungen

---

## Geklärte Fragen

- ✅ **Auth-Flow** → JWT in Secure Storage (Capacitor), weg von Cookies
- ✅ **SvelteKit Adapter** → `adapter-static` für Mobile-Build (SPA-Modus)
- ✅ **Plattform-Reihenfolge** → Android first, iOS wenn Mac da
- ✅ **Build-Pipeline** → GitHub Actions (CI/CD), passend zu bestehenden Workflows
- ✅ **Offline-Strategie** → so viel wie möglich cachen, step-by-step bei Entwicklung klären
- ✅ **App-Updates** → Hybrid (OTA für Web-Code, Store-Update für native Änderungen)
- ✅ **Versionierung** → Major-Version synchron mit Web, Minor/Patch unabhängig
- ✅ **Testing** → Android Emulator + physisches Gerät

## Offene Fragen

Keine — bereit für Masterplan.

---

## Risiken

- **iOS WebView-Limitierungen** — WKWebView hat Einschränkungen (kein SharedWorker, begrenzte IndexedDB)
- **Adapter-Wechsel** — `adapter-static` erzeugt SPA, kein SSR → Routing-Logik prüfen
- **Dual-Maintenance** — auch wenn gleicher Code: native Bugs, Store-Reviews, OS-Updates
- **Offline-Sync-Konflikte** — wenn Schreibzugriff offline kommt: Conflict Resolution nötig

---

## Grobe Phasen (noch nicht detailliert)

1. **Foundation** — Capacitor Setup, Adapter-Wechsel, Build-Pipeline, erster nativer Build
2. **Native Plugins** — Camera, Push, Biometrics, StatusBar, SplashScreen
3. **Offline-Layer** — Service Worker, IndexedDB Cache, Read-Only-Modus
4. **Touch & UX** — Mobile-spezifische UI-Anpassungen, Gesten, Keyboard-Handling
5. **Store-Release** — App Icons, Screenshots, Store Listings, Review-Prozess
6. **Hardening** — Performance, Battery, Memory, Crash Reporting

---

## Kapazitäten

- Apple Developer Account: ✓ vorhanden
- Google Play Developer Account: ✓ vorhanden
- Mac für iOS-Builds: ✗ noch nicht — wird besorgt
- Android Studio: ? (muss installiert werden für Android-Builds)

---

_Nächster Schritt: Masterplan schreiben_

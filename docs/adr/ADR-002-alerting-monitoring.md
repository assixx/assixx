# ADR-002: Alerting und Monitoring Stack

**Date:** 2026-01-11

## Status

Proposed

## Context

Nach Abschluss der SvelteKit-Migration (Phase 3) benötigen wir ein Alerting- und Monitoring-System für Production. Ohne Error Tracking sind wir blind wenn die App crasht.

Unser Tech-Stack besteht aus SvelteKit 5 (Frontend), NestJS 11 + Fastify 5 (Backend), TypeScript, PostgreSQL 17, Redis 7, Nginx und Docker Compose. Logging wird auf Pino migriert (siehe PINO-LOGGING-PLAN.md).

Wir haben drei Optionen evaluiert:

**Option 1: Sentry SaaS** - Error Tracking als Cloud-Dienst mit nativen SDKs für SvelteKit (`@sentry/sveltekit`) und NestJS (`@sentry/nestjs`). Features: Automatisches Error Capture, Source Maps, Distributed Tracing, Session Replay, Alerting. Keine Infrastruktur nötig.

**Option 2: Sentry Self-Hosted** - Gleiche Features wie SaaS, aber selbst gehostet. Benötigt mindestens 32 GB RAM (16 GB + 16 GB Swap), 4 CPU Cores mit SSE 4.2, und deployed 23+ Docker Container (Kafka, Zookeeper, ClickHouse, Snuba, etc.). Quelle: [Sentry Self-Hosted Docs](https://develop.sentry.dev/self-hosted/)

**Option 3: PLG Stack (Prometheus + Loki + Grafana)** - Open-Source Observability Stack. Prometheus für Metrics, Loki für Log Aggregation (perfekte Pino-Integration), Grafana für Dashboards. Benötigt nur 4-8 GB RAM und 4 Container. Bietet jedoch kein automatisches Error Tracking, keine Source Maps, kein Session Replay.

## Decision

Wir werden **Sentry SaaS für Error Tracking** und **Pino für Logging** nutzen. Der PLG Stack wird als optionale Erweiterung für Phase 5 betrachtet.

Sentry Self-Hosted wird abgelehnt wegen unverhältnismäßigem Ressourcenbedarf (32 GB RAM, 23+ Container für Error Tracking) - dies verletzt das KISS-Prinzip massiv.

Sentry SaaS ist optimal weil:

- Native SDKs für exakt unseren Stack (SvelteKit + NestJS)
- Zero-Config Error Tracking mit Source Maps
- Session Replay ermöglicht "Video-Reproduktion" von Bugs
- Distributed Tracing von Frontend bis Backend
- Kein Infrastruktur-Overhead

Der PLG Stack ergänzt später für:

- Pino-Log-Aggregation via Loki
- System-Metriken via Prometheus
- Custom Dashboards via Grafana

## Consequences

**Positiv:**

- Sofortige Sichtbarkeit von Production-Errors
- Native Integration ohne Workarounds
- Session Replay beschleunigt Bug-Reproduktion
- Geringer initialer Aufwand (SaaS = keine Infrastruktur)
- Pino-Logs bleiben lokal bis PLG Stack implementiert

**Negativ:**

- Externe Abhängigkeit von Sentry (SaaS)
- Error-Daten liegen bei Drittanbieter
- Free Tier hat Limits (5k Errors, 1 User, 7-Tage Retention)
- Log Aggregation erst mit PLG Stack verfügbar (Phase 5)

**Neutral:**

- PLG Stack kann später ohne Konflikte hinzugefügt werden
- Sentry und PLG Stack sind komplementär, nicht konkurrierend

---

## References

### Sentry

- [Sentry SvelteKit Guide](https://docs.sentry.io/platforms/javascript/guides/sveltekit/)
- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry Fastify Guide](https://docs.sentry.io/platforms/javascript/guides/fastify/)
- [Sentry Self-Hosted Requirements](https://develop.sentry.dev/self-hosted/)

### PLG Stack (Phase 5)

- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Documentation](https://grafana.com/docs/grafana/latest/datasources/prometheus/)

### Pino → Loki Integration

- [pino-loki v3.0.0 (npm)](https://www.npmjs.com/package/pino-loki) - Pino Transport für Loki
- [pino-loki (GitHub)](https://github.com/Julien-R44/pino-loki) - Source Code
- [Grafana Dashboard: Pino HTTP Logs](https://grafana.com/grafana/dashboards/21900-pino-http-logs/) - Fertiges Dashboard für pino-http

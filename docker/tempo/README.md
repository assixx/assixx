# Tempo — Distributed Tracing Backend

Grafana Tempo stores traces. Only talks OTLP in from the OTel Collector, HTTP query API out to Grafana.

- **Image**: `grafana/tempo:2.6.1` (35 MB — one of the smallest observability images)
- **Config**: [`tempo.yaml`](./tempo.yaml)
- **Volume**: `tempo_data` (Docker named volume)
- **Ports**:
  - `3200` (HTTP query API, published to host for Grafana datasource)
  - `4317`/`4318` (OTLP gRPC/HTTP receiver — **internal Docker network only**, not published)

## Why Single-Binary Mode?

Tempo has micro-service mode (distributor/ingester/querier/compactor as separate processes) for high-volume deployments. Assixx volume — even with 100 tenants × 1000 req/min — is well within single-binary limits. **Don't** split until load demands it. KISS.

## Storage

Local filesystem backend in dev — 72 h retention. For prod: swap to S3-compat block storage (see commented-out section in `tempo.yaml`). Tempo was designed for cheap object storage — that's its main cost-advantage over Jaeger.

## Related

- [ADR-048 Distributed Tracing with Tempo + OTel](../../docs/infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md)
- [FEAT_TEMPO_OTEL_MASTERPLAN](../../docs/FEAT_TEMPO_OTEL_MASTERPLAN.md)
- [docker/otel-collector/](../otel-collector/) — upstream sender

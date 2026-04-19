# OpenTelemetry Collector

Aggregation + tail-sampling hub for Assixx traces. All application telemetry transits here on the way to Tempo.

- **Image**: `otel/opentelemetry-collector-contrib:0.150.1` — **contrib** distribution is mandatory (core has no `tail_sampling` processor)
- **Config**: [`collector.yaml`](./collector.yaml)
- **Ports**:
  - `4317` (OTLP gRPC, published — backends connect here)
  - `4318` (OTLP HTTP, published — frontend-from-browser path, currently unused)
  - `13133` (health check, internal only)
  - `8888` (collector's own Prometheus-format metrics, internal — scrape target if wanted)

## Why a Collector at all (not direct App → Tempo)?

Three things the Collector does that no app-side SDK cleanly does:

1. **Tail-based sampling** — decide after seeing all spans in a trace. Head-sampling (pre-decided in SDK) can't know "was this request slow / errored?" when deciding. We want to keep 100 % of errors + slow requests + 10 % of happy-path. Only possible tail-side.
2. **Backpressure / batching** — if Tempo is slow or down, the collector buffers. App-side SDK would either block request-handling or drop silently.
3. **Routing / fan-out** — today goes to Tempo only. Tomorrow easy to add a 2nd exporter (Grafana Cloud Traces, or X-Ray, or Honeycomb) without app code changes. This is the OTel-standard decoupling.

## Core vs. Contrib Distribution

|            | core                                          | **contrib** ✓                                                    |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Image size | ~30 MB                                        | ~200 MB                                                          |
| Receivers  | OTLP + few basics                             | OTLP + 100+ (Jaeger, Zipkin, Prometheus, Kafka, …)               |
| Processors | batch, memory_limiter, probabilistic_sampling | All of core + `tail_sampling` + many more                        |
| Exporters  | OTLP, debug, file                             | All of core + Tempo-native, Loki, Prometheus remote_write, S3, … |

We need `tail_sampling` → contrib.

## Related

- [ADR-048 Distributed Tracing with Tempo + OTel](../../docs/infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md)
- [FEAT_TEMPO_OTEL_MASTERPLAN](../../docs/FEAT_TEMPO_OTEL_MASTERPLAN.md)
- [docker/tempo/](../tempo/) — downstream sink

# 2.1 Monitoring & Observability

Implement comprehensive monitoring to ensure production ML systems stay healthy and performant.

---

## Overview

You can't improve what you don't measure. Monitoring is critical for:

- **Detecting issues early**: Catch problems before they impact users
- **Understanding performance**: Know where bottlenecks exist
- **Validating changes**: Ensure new models improve metrics
- **Compliance**: Track predictions for audit trails
- **Cost management**: Identify resource waste

This chapter covers what to monitor, how to monitor it, and how to act on the insights.

---

## The Three Pillars of Observability

### 1. Metrics

**What**: Numeric measurements over time (latency, error rate, CPU usage)

**When to use**: Understand system behavior and trends

**Examples**:
- Request rate: 1,500 requests/second
- p99 latency: 85ms
- Error rate: 0.3%
- Model confidence: avg 0.87

### 2. Logs

**What**: Structured records of events (request/response, errors, audit trails)

**When to use**: Debug specific issues, trace individual requests

**Examples**:
```json
{
  "timestamp": "2025-10-26T10:30:45Z",
  "request_id": "abc-123",
  "endpoint": "/predict",
  "input": {"user_id": "123", "item_id": "456"},
  "prediction": {"score": 0.94, "class": "positive"},
  "latency_ms": 42,
  "model_version": "v3.2"
}
```

### 3. Traces

**What**: End-to-end request paths through distributed systems

**When to use**: Identify performance bottlenecks across services

**Example trace**:
```
Request → API Gateway (5ms)
  → Load Balancer (2ms)
    → Prediction Service (45ms)
      → Feature Store (15ms)
      → Model Inference (28ms)
    → Response (2ms)
Total: 97ms
```

---

## What to Monitor

### Infrastructure Metrics

Track system-level health and resource usage.

#### Request Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Request Rate** | Requests per second | Varies | N/A (informational) |
| **Latency (p50)** | Median response time | < 50ms | > 100ms |
| **Latency (p95)** | 95th percentile | < 100ms | > 200ms |
| **Latency (p99)** | 99th percentile | < 200ms | > 500ms |
| **Error Rate** | % of failed requests | < 0.1% | > 1% |
| **Timeout Rate** | % of timed out requests | < 0.01% | > 0.1% |

**Implementation (Prometheus)**:
```python
from prometheus_client import Counter, Histogram, Gauge

# Request counter
request_count = Counter(
    'prediction_requests_total',
    'Total prediction requests',
    ['endpoint', 'model_version', 'status']
)

# Latency histogram
request_latency = Histogram(
    'prediction_latency_seconds',
    'Prediction latency',
    ['endpoint', 'model_version'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

# Error counter
error_count = Counter(
    'prediction_errors_total',
    'Prediction errors',
    ['endpoint', 'error_type']
)

@app.post("/predict")
async def predict(request: PredictionRequest):
    start_time = time.time()

    try:
        result = model.predict(request.dict())

        # Record success
        request_count.labels(
            endpoint='/predict',
            model_version='v3',
            status='success'
        ).inc()

        return result

    except Exception as e:
        # Record error
        error_count.labels(
            endpoint='/predict',
            error_type=type(e).__name__
        ).inc()

        raise

    finally:
        # Record latency
        duration = time.time() - start_time
        request_latency.labels(
            endpoint='/predict',
            model_version='v3'
        ).observe(duration)
```

#### Resource Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **CPU Usage** | % CPU utilized | > 80% sustained |
| **Memory Usage** | % RAM used | > 85% |
| **GPU Usage** | % GPU utilized | > 95% or < 20% (waste) |
| **Disk I/O** | Read/write ops per sec | High variance |
| **Network I/O** | Bytes sent/received | Unusual spikes |

**Auto-scaling based on metrics**:
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: prediction-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prediction-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: prediction_latency_p99
      target:
        type: AverageValue
        averageValue: 200m  # 200ms
```

---

### Model Performance Metrics

Track model quality and behavior.

#### Prediction Metrics

| Metric | Description | Purpose |
|--------|-------------|---------|
| **Prediction Distribution** | Distribution of predicted values | Detect drift |
| **Confidence Distribution** | Distribution of model confidence | Monitor uncertainty |
| **Class Balance** | Distribution of predicted classes | Check for bias |
| **Null Predictions** | % of null/invalid outputs | Data quality |

**Implementation**:
```python
from prometheus_client import Histogram

# Prediction score distribution
prediction_score = Histogram(
    'prediction_score',
    'Predicted score distribution',
    ['model_version'],
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Confidence distribution
prediction_confidence = Histogram(
    'prediction_confidence',
    'Model confidence distribution',
    ['model_version'],
    buckets=[0.0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0]
)

@app.post("/predict")
async def predict(request: PredictionRequest):
    result = model.predict(request.dict())

    # Record prediction metrics
    prediction_score.labels(model_version='v3').observe(result['score'])
    prediction_confidence.labels(model_version='v3').observe(result['confidence'])

    return result
```

#### Ground Truth Metrics

When labels become available (e.g., user feedback, manual review):

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **Accuracy** | % of correct predictions | < 90% (depends on baseline) |
| **Precision** | True positives / (TP + FP) | < target precision |
| **Recall** | True positives / (TP + FN) | < target recall |
| **F1 Score** | Harmonic mean of precision/recall | < baseline |
| **AUC-ROC** | Area under ROC curve | < baseline - 0.05 |

**Implementation** (batch evaluation):
```python
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

def evaluate_predictions(start_date, end_date):
    """Evaluate predictions against ground truth labels."""

    # Fetch predictions
    predictions = db.query(f"""
        SELECT prediction_id, predicted_class, predicted_score, true_label
        FROM predictions
        WHERE date BETWEEN '{start_date}' AND '{end_date}'
        AND true_label IS NOT NULL
    """)

    # Calculate metrics
    accuracy = accuracy_score(
        predictions['true_label'],
        predictions['predicted_class']
    )

    precision, recall, f1, _ = precision_recall_fscore_support(
        predictions['true_label'],
        predictions['predicted_class'],
        average='weighted'
    )

    # Log metrics
    metrics_logger.log({
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'sample_size': len(predictions),
        'evaluation_date': date.today()
    })

    # Alert if metrics degrade
    if accuracy < ACCURACY_THRESHOLD:
        alert_ops_team(f"Accuracy dropped to {accuracy:.2%}")

# Run daily
schedule.every().day.at("02:00").do(
    lambda: evaluate_predictions(
        start_date=date.today() - timedelta(days=1),
        end_date=date.today()
    )
)
```

---

### Data Quality Metrics

Monitor input data for anomalies and drift.

| Metric | Description | Detection Method |
|--------|-------------|------------------|
| **Feature Distribution** | Statistical properties of features | Compare to training distribution |
| **Missing Values** | % of null/missing features | Alert if > baseline |
| **Outliers** | Values far from expected range | Statistical tests |
| **Data Drift** | Distribution shift over time | KS test, PSI |

**Implementation (data drift detection)**:
```python
import numpy as np
from scipy.stats import ks_2samp

class DriftDetector:
    """Detect data drift in production."""

    def __init__(self, reference_data):
        """Initialize with training data distribution."""
        self.reference_data = reference_data

    def detect_drift(self, production_data, feature_name, threshold=0.05):
        """Detect drift using Kolmogorov-Smirnov test."""

        # Get reference and production distributions
        reference_feature = self.reference_data[feature_name]
        production_feature = production_data[feature_name]

        # Run KS test
        statistic, p_value = ks_2samp(reference_feature, production_feature)

        # Alert if significant drift
        if p_value < threshold:
            alert_data_team(
                f"Data drift detected in {feature_name}: "
                f"KS statistic={statistic:.3f}, p-value={p_value:.4f}"
            )

            return True

        return False

# Usage
detector = DriftDetector(reference_data=training_data)

# Run hourly
@schedule.every().hour.do
def check_drift():
    # Fetch recent production data
    production_data = get_recent_predictions(hours=1)

    # Check each feature
    for feature in ['age', 'income', 'credit_score']:
        detector.detect_drift(production_data, feature)
```

---

## Logging Best Practices

### Structured Logging

Use structured logs (JSON) instead of plain text:

❌ **Bad (unstructured)**:
```python
logger.info(f"Prediction for user {user_id}: {prediction}, latency: {latency}ms")
```

✅ **Good (structured)**:
```python
logger.info("prediction_complete", extra={
    "user_id": user_id,
    "prediction": prediction,
    "latency_ms": latency,
    "model_version": "v3",
    "timestamp": datetime.utcnow().isoformat()
})
```

**Why?** Structured logs are:
- Easier to query and analyze
- Better for log aggregation tools (ELK, Splunk)
- Consistent format across services

### What to Log

**Every request should log**:
```python
{
    "request_id": "unique-id",           # For tracing
    "timestamp": "2025-10-26T10:30:45Z", # When
    "endpoint": "/predict",              # What endpoint
    "input": {...},                      # Input features (sanitized)
    "prediction": {...},                 # Output prediction
    "model_version": "v3.2",             # Which model
    "latency_ms": 42,                    # How long
    "user_id": "user_123",               # Who (if applicable)
    "status": "success"                  # Success or error
}
```

**For errors, additionally log**:
```python
{
    "error_type": "ValueError",
    "error_message": "Invalid input format",
    "stack_trace": "...",
    "input_sample": {...}  # Sanitized sample for debugging
}
```

### Log Sampling

For high-traffic systems, log every request (100% sampling) can be expensive. Instead:

```python
import random

def should_log_request():
    """Log 10% of requests, always log errors."""
    return random.random() < 0.10

@app.post("/predict")
async def predict(request):
    start_time = time.time()

    try:
        result = model.predict(request.dict())

        # Log 10% of successful requests
        if should_log_request():
            log_prediction(request, result, time.time() - start_time)

        return result

    except Exception as e:
        # Always log errors
        log_error(request, e, time.time() - start_time)
        raise
```

---

## Distributed Tracing

For systems with multiple services, use distributed tracing to track requests end-to-end.

### OpenTelemetry Integration

```python
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter

# Set up tracing
trace.set_tracer_provider(TracerProvider())
jaeger_exporter = JaegerExporter(
    agent_host_name="localhost",
    agent_port=6831
)
trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(jaeger_exporter)
)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

# Custom spans
tracer = trace.get_tracer(__name__)

@app.post("/predict")
async def predict(request: PredictionRequest):
    with tracer.start_as_current_span("extract_features"):
        features = extract_features(request)

    with tracer.start_as_current_span("model_inference"):
        prediction = model.predict(features)

    with tracer.start_as_current_span("postprocess"):
        result = postprocess(prediction)

    return result
```

**Trace visualization (Jaeger)**:
```
Request /predict [Total: 97ms]
├─ extract_features [15ms]
│  ├─ fetch_user_features [8ms]
│  └─ fetch_item_features [7ms]
├─ model_inference [65ms]
│  ├─ load_model [2ms]
│  ├─ run_inference [60ms]
│  └─ format_output [3ms]
└─ postprocess [5ms]
   └─ apply_business_rules [5ms]
```

---

## Dashboards

Create real-time dashboards to visualize system health.

### Essential Dashboards

#### 1. System Health Dashboard

**Panels**:
- Request rate (time series)
- Latency (p50, p95, p99) (time series)
- Error rate (time series)
- Active replicas (gauge)
- CPU/Memory usage (time series)

**Grafana example**:
```json
{
  "dashboard": {
    "title": "ML System Health",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(prediction_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Latency (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, prediction_latency_seconds)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(prediction_errors_total[5m]) / rate(prediction_requests_total[5m])"
          }
        ]
      }
    ]
  }
}
```

#### 2. Model Performance Dashboard

**Panels**:
- Prediction distribution (histogram)
- Confidence distribution (histogram)
- Class distribution (pie chart)
- Daily accuracy (if labels available) (time series)
- Drift score (time series)

#### 3. Business Metrics Dashboard

**Panels**:
- Predictions per customer segment
- Revenue impact of predictions
- Conversion rate (if applicable)
- Cost per prediction

---

## Alerting

Set up automated alerts for critical issues.

### Alert Rules

**Critical (Page immediately)**:
```yaml
# Prometheus alerting rules
groups:
- name: ml_system_critical
  rules:
  - alert: HighErrorRate
    expr: rate(prediction_errors_total[5m]) / rate(prediction_requests_total[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Error rate above 5% for 2 minutes"

  - alert: HighLatency
    expr: histogram_quantile(0.99, prediction_latency_seconds) > 1.0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "p99 latency above 1 second"

  - alert: ServiceDown
    expr: up{job="prediction-service"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Prediction service is down"
```

**Warning (Notify, investigate)**:
```yaml
- name: ml_system_warning
  rules:
  - alert: ModelAccuracyDrop
    expr: model_accuracy < 0.90
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "Model accuracy dropped below 90%"

  - alert: HighCPUUsage
    expr: avg(cpu_usage) > 0.80
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "CPU usage above 80% for 10 minutes"

  - alert: DataDrift
    expr: drift_score > 0.1
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "Data drift detected"
```

### Alert Routing

```yaml
# Alertmanager config
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
  - match:
      severity: critical
    receiver: pagerduty

  - match:
      severity: warning
    receiver: slack

receivers:
- name: pagerduty
  pagerduty_configs:
  - service_key: <key>

- name: slack
  slack_configs:
  - channel: '#ml-alerts'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

---

## Monitoring Checklist

Before going to production, ensure:

**Infrastructure**:
- [ ] Request rate, latency, error rate tracked
- [ ] Resource usage (CPU, memory, GPU) monitored
- [ ] Auto-scaling configured based on metrics
- [ ] Health checks implemented

**Model**:
- [ ] Prediction distribution logged
- [ ] Ground truth accuracy evaluated (when available)
- [ ] Data drift detection implemented
- [ ] Model version tracked in all requests

**Logging**:
- [ ] Structured logging implemented
- [ ] Request/response logged (with sampling)
- [ ] Errors logged with stack traces
- [ ] Log retention policy defined

**Tracing**:
- [ ] Distributed tracing enabled
- [ ] Performance bottlenecks identifiable
- [ ] Request IDs propagated across services

**Dashboards**:
- [ ] System health dashboard created
- [ ] Model performance dashboard created
- [ ] Business metrics dashboard created

**Alerting**:
- [ ] Critical alerts configured (errors, latency, downtime)
- [ ] Warning alerts configured (drift, resource usage)
- [ ] Alert routing set up (PagerDuty, Slack)
- [ ] Runbooks created for common alerts

---

## Next Steps

- **[Scaling & Performance](./05-scaling.md)**: Optimize your system for production traffic
- **[Incident Response](./09-incident-response.md)**: Handle production incidents effectively

---

## Summary

Effective monitoring requires:
1. **Metrics**: Track system and model performance
2. **Logs**: Debug issues and audit predictions
3. **Traces**: Identify bottlenecks across services
4. **Dashboards**: Visualize system health
5. **Alerts**: Detect and respond to issues quickly

Start with infrastructure metrics, add model metrics, then iterate based on operational needs.

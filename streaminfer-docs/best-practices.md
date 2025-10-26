# Best Practices

Production-ready patterns for deploying and managing ML models with StreamInfer.

---

## Table of Contents

- [Authentication & Security](#authentication--security)
- [Error Handling & Retries](#error-handling--retries)
- [Performance Optimization](#performance-optimization)
- [Scaling Strategies](#scaling-strategies)
- [Monitoring & Observability](#monitoring--observability)
- [Cost Optimization](#cost-optimization)
- [Deployment Patterns](#deployment-patterns)

---

## Authentication & Security

### Store API Keys Securely

**Never** hardcode API keys in your source code or commit them to version control.

**❌ Bad**:
```python
client = streaminfer.Client(api_key="si_live_abc123...")
```

**✅ Good**:
```python
import os
client = streaminfer.Client(api_key=os.environ["STREAMINFER_API_KEY"])
```

### Use Different Keys for Different Environments

Maintain separate API keys for development, staging, and production:

```python
import os

env = os.environ.get("ENVIRONMENT", "development")

api_keys = {
    "development": os.environ["STREAMINFER_API_KEY_DEV"],
    "staging": os.environ["STREAMINFER_API_KEY_STAGING"],
    "production": os.environ["STREAMINFER_API_KEY_PROD"]
}

client = streaminfer.Client(api_key=api_keys[env])
```

### Rotate Keys Regularly

Rotate your API keys every 90 days to minimize risk:

1. Create a new API key in the dashboard
2. Update your production environment variables
3. Deploy the change
4. Revoke the old key after 24-48 hours (grace period)

### Implement Request Authentication

For user-facing applications, don't expose your StreamInfer API key to clients. Instead, proxy requests through your backend:

```python
# backend.py (FastAPI example)
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer
import streaminfer

app = FastAPI()
security = HTTPBearer()
client = streaminfer.Client()

def verify_user_token(token: str):
    # Your authentication logic
    pass

@app.post("/predict")
async def predict(request: dict, credentials = Depends(security)):
    verify_user_token(credentials.credentials)

    endpoint = client.get_endpoint("sentiment-classifier")
    result = endpoint.predict(request)
    return result
```

This keeps your StreamInfer API key secure on the server side.

---

## Error Handling & Retries

### Implement Comprehensive Error Handling

Handle different error types appropriately:

```python
import streaminfer
from streaminfer.exceptions import (
    AuthenticationError,
    RateLimitError,
    ModelInferenceError,
    EndpointNotFoundError
)

def predict_with_error_handling(endpoint, data):
    try:
        return endpoint.predict(data)

    except AuthenticationError as e:
        # API key issue - log and alert
        logger.error(f"Authentication failed: {e}")
        raise

    except RateLimitError as e:
        # Rate limit hit - implement backoff
        logger.warning(f"Rate limit exceeded: {e}")
        time.sleep(e.retry_after_seconds)
        return predict_with_error_handling(endpoint, data)  # Retry

    except ModelInferenceError as e:
        # Model failed - may be temporary
        logger.error(f"Inference failed: {e}")
        # Return cached result or default prediction
        return get_cached_prediction(data)

    except EndpointNotFoundError as e:
        # Configuration issue - critical error
        logger.critical(f"Endpoint not found: {e}")
        alert_ops_team()
        raise
```

### Use Exponential Backoff for Retries

Implement exponential backoff for transient failures:

```python
import time
import random

def predict_with_retry(endpoint, data, max_retries=3):
    for attempt in range(max_retries):
        try:
            return endpoint.predict(data)
        except Exception as e:
            if attempt == max_retries - 1:
                raise

            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time:.2f}s")
            time.sleep(wait_time)
```

### Set Appropriate Timeouts

Configure timeouts to prevent hanging requests:

```python
endpoint = client.deploy(
    model_path="./model.onnx",
    endpoint_name="my-model",
    timeout_seconds=30  # Request timeout
)

# Client-side timeout
result = endpoint.predict(data, timeout=10)  # 10-second client timeout
```

**Rule of thumb**: Set client timeout slightly lower than server timeout to handle network delays.

---

## Performance Optimization

### Use Batch Predictions

Batch requests are **significantly** more efficient than individual requests:

**❌ Inefficient**:
```python
results = []
for item in items:
    result = endpoint.predict({"text": item})
    results.append(result)
# 100 items = 100 HTTP requests
```

**✅ Efficient**:
```python
results = endpoint.predict_batch([{"text": item} for item in items])
# 100 items = 1 HTTP request
```

**Performance comparison** (100 predictions):
- Individual requests: ~2.5 seconds (25ms avg per request)
- Batch request: ~150ms (1.5ms per prediction)

### Enable Model Caching

Cache identical requests to reduce latency and costs:

```python
endpoint.update_config(
    enable_cache=True,
    cache_ttl_seconds=300  # 5 minutes
)
```

**When to use caching**:
- ✅ Repeated queries (e.g., sentiment for popular products)
- ✅ Idempotent predictions (same input always produces same output)
- ❌ Time-sensitive predictions (e.g., fraud detection with temporal features)
- ❌ Non-deterministic models (dropout, sampling, etc.)

### Optimize Input/Output Sizes

Minimize payload sizes for faster transfers:

```python
# ❌ Sending large image directly
result = endpoint.predict({
    "image": base64.b64encode(large_image).decode()  # 5MB payload
})

# ✅ Use signed URLs for large files
signed_url = upload_to_s3(large_image)
result = endpoint.predict({
    "image_url": signed_url  # Small payload
})
```

### Choose the Right Instance Type

Match instance type to your model's requirements:

| Model Size | Inference Time | Recommended Instance |
|------------|----------------|---------------------|
| < 100MB | < 10ms | `cpu.small` |
| 100-500MB | 10-50ms | `cpu.medium` or `gpu.t4.small` |
| 500MB-2GB | 50-200ms | `gpu.t4.small` or `gpu.a10.small` |
| > 2GB | > 200ms | `gpu.a100.small` |

**General guideline**: Use GPU instances when:
- Model has > 50M parameters
- Inference time on CPU > 100ms
- Request volume justifies the cost

---

## Scaling Strategies

### Configure Autoscaling Properly

Set appropriate min/max replicas based on traffic patterns:

```python
# Development/staging
endpoint = client.deploy(
    model_path="./model.onnx",
    endpoint_name="dev-model",
    min_replicas=0,  # Scale to zero when idle
    max_replicas=3
)

# Production
endpoint = client.deploy(
    model_path="./model.onnx",
    endpoint_name="prod-model",
    min_replicas=2,  # Always-on for reliability
    max_replicas=20,
    target_latency_ms=50  # Scale to maintain p95 < 50ms
)
```

**Best practices**:
- **Development**: `min_replicas=0` to save costs
- **Production**: `min_replicas >= 2` for high availability
- **High traffic**: Set `max_replicas` to 2-3x peak traffic capacity

### Handle Cold Starts

When `min_replicas=0`, the first request after idle time triggers a cold start (~10-30 seconds):

```python
# Option 1: Keep-alive ping
import schedule

def keep_endpoint_warm():
    endpoint.predict({"warmup": True})

# Ping every 5 minutes
schedule.every(5).minutes.do(keep_endpoint_warm)
```

```python
# Option 2: Set min_replicas=1 for critical endpoints
endpoint.update_config(min_replicas=1)
```

### Pre-warm Endpoints Before Traffic Spikes

If you know traffic will spike (e.g., product launch), pre-scale:

```python
# Before launch
endpoint.update_config(min_replicas=10)

# After spike subsides
endpoint.update_config(min_replicas=2)
```

---

## Monitoring & Observability

### Track Key Metrics

Monitor these metrics for production endpoints:

```python
import time

def monitor_endpoint(endpoint_name):
    endpoint = client.get_endpoint(endpoint_name)
    metrics = endpoint.get_metrics(period="1h")

    # Latency
    if metrics.latency_p99_ms > 500:
        alert("High P99 latency", metrics.latency_p99_ms)

    # Error rate
    if metrics.error_rate > 0.05:  # 5%
        alert("High error rate", metrics.error_rate)

    # Throughput
    requests_per_second = metrics.request_count / 3600
    if requests_per_second < expected_rps * 0.5:
        alert("Low traffic - potential issue", requests_per_second)
```

### Implement Structured Logging

Log requests and responses for debugging:

```python
import logging
import json

logger = logging.getLogger(__name__)

def predict_with_logging(endpoint, data, request_id):
    logger.info(f"Inference request", extra={
        "request_id": request_id,
        "endpoint": endpoint.name,
        "input_size": len(json.dumps(data))
    })

    start_time = time.time()

    try:
        result = endpoint.predict(data)
        latency = (time.time() - start_time) * 1000

        logger.info(f"Inference success", extra={
            "request_id": request_id,
            "latency_ms": latency,
            "model_version": result.get("model_version")
        })

        return result

    except Exception as e:
        logger.error(f"Inference failed", extra={
            "request_id": request_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise
```

### Set Up Alerts

Configure alerts for critical issues:

```python
from streaminfer import Webhook

# Create webhook for alerts
webhook = client.create_webhook(
    url="https://your-app.com/alerts",
    events=[
        "high_error_rate",    # Error rate > 5% for 5 min
        "high_latency",       # P99 > 1s for 5 min
        "endpoint.failed",    # Endpoint deployment failed
    ]
)
```

---

## Cost Optimization

### Use Spot Instances for Non-Critical Workloads

For batch processing and non-time-sensitive workloads:

```python
endpoint = client.deploy(
    model_path="./model.onnx",
    endpoint_name="batch-processor",
    instance_type="cpu.large",
    use_spot_instances=True,  # 60-70% cheaper
    min_replicas=0
)
```

**Warning**: Spot instances can be interrupted. Not recommended for user-facing APIs.

### Scale to Zero During Off-Hours

For applications with predictable traffic patterns:

```python
import schedule

def scale_for_business_hours():
    current_hour = datetime.now().hour

    if 9 <= current_hour <= 17:  # Business hours
        endpoint.update_config(min_replicas=5)
    else:
        endpoint.update_config(min_replicas=1)

schedule.every().hour.do(scale_for_business_hours)
```

### Monitor and Optimize Cache Hit Rates

```python
metrics = endpoint.get_metrics(period="24h")

cache_hit_rate = metrics.cache_hits / metrics.request_count
logger.info(f"Cache hit rate: {cache_hit_rate:.2%}")

if cache_hit_rate < 0.20:  # Less than 20%
    # Consider disabling cache or adjusting TTL
    endpoint.update_config(enable_cache=False)
```

### Right-size Your Instances

Regularly review utilization:

```python
metrics = endpoint.get_metrics(period="7d")

avg_utilization = metrics.avg_cpu_utilization

if avg_utilization < 30:
    logger.warning("Consider downsizing to cpu.small")
elif avg_utilization > 80:
    logger.warning("Consider upsizing to cpu.large")
```

---

## Deployment Patterns

### Blue-Green Deployments

Deploy a new version alongside the old, then switch traffic instantly:

```python
# Deploy v2 with 0% traffic
endpoint.deploy_version(
    model_path="./model_v2.onnx",
    version_name="v2",
    traffic_percentage=0
)

# Validate v2 manually
test_results = endpoint.predict(test_data, version="v2")
assert test_results["accuracy"] > 0.95

# Switch 100% traffic to v2
endpoint.set_traffic_split({"v1": 0, "v2": 100})

# If issues arise, instant rollback
endpoint.set_traffic_split({"v1": 100, "v2": 0})
```

### Canary Deployments

Gradually roll out changes:

```python
# Deploy v2 with 5% traffic
endpoint.deploy_version(
    model_path="./model_v2.onnx",
    version_name="v2",
    traffic_percentage=5
)

# Monitor for 1 hour
time.sleep(3600)
v2_metrics = endpoint.get_version_metrics("v2", period="1h")

if v2_metrics.error_rate < 0.01:
    # Increase to 25%
    endpoint.set_traffic_split({"v1": 75, "v2": 25})

    # Continue gradual rollout...
    # 5% → 25% → 50% → 100%
else:
    # Rollback
    endpoint.set_traffic_split({"v1": 100, "v2": 0})
    endpoint.delete_version("v2")
```

### A/B Testing

Compare two model versions:

```python
# Deploy champion (v1) and challenger (v2)
endpoint.set_traffic_split({"v1": 50, "v2": 50})

# Run for 1 week
time.sleep(7 * 24 * 3600)

# Compare metrics
v1_metrics = endpoint.get_version_metrics("v1", period="7d")
v2_metrics = endpoint.get_version_metrics("v2", period="7d")

if v2_metrics.latency_p99_ms < v1_metrics.latency_p99_ms:
    print("v2 is faster, rolling out 100%")
    endpoint.set_traffic_split({"v1": 0, "v2": 100})
else:
    print("v1 is still champion, removing v2")
    endpoint.set_traffic_split({"v1": 100, "v2": 0})
    endpoint.delete_version("v2")
```

### Shadow Mode

Test a new model without affecting production traffic:

```python
# Route 100% of traffic to v1, but also send copies to v2
endpoint.deploy_version(
    model_path="./model_v2.onnx",
    version_name="v2",
    shadow_mode=True  # Receives traffic but doesn't return responses
)

# Analyze v2's predictions vs. v1
shadow_metrics = endpoint.get_shadow_metrics("v2", period="24h")
print(f"Prediction agreement: {shadow_metrics.agreement_rate}%")
```

---

## Integration Patterns

### Async Predictions for Long-Running Models

For models with > 5 second inference time, use async pattern:

```python
# Submit async prediction
job = endpoint.predict_async(large_video)
print(f"Job ID: {job.id}")

# Poll for completion
while not job.is_complete():
    time.sleep(5)
    job.refresh()

result = job.get_result()
```

### Webhook for Async Results

Better: Get notified when the prediction completes:

```python
# Submit with callback URL
job = endpoint.predict_async(
    data=large_video,
    callback_url="https://your-app.com/predictions/callback"
)

# Your callback endpoint receives:
# POST /predictions/callback
# {
#   "job_id": "job_abc123",
#   "status": "completed",
#   "result": {...}
# }
```

### Streaming Predictions

For real-time streaming applications (e.g., video analysis):

```python
import streaminfer

endpoint = client.get_endpoint("video-analyzer")

# Stream frames
for frame in video_stream:
    result = endpoint.predict({"frame": frame})
    process_result(result)
```

---

## Testing

### Test Models Locally Before Deploying

```python
# Load model locally
import onnxruntime as ort

session = ort.InferenceSession("model.onnx")
local_result = session.run(None, {"input": test_data})

# Deploy to StreamInfer
endpoint = client.deploy(model_path="model.onnx", endpoint_name="test")

# Compare results
remote_result = endpoint.predict(test_data)

assert np.allclose(local_result, remote_result["prediction"])
```

### Integration Tests

```python
import pytest

def test_endpoint_deployment():
    endpoint = client.deploy(
        model_path="./test_model.onnx",
        endpoint_name=f"test-{uuid.uuid4()}",
        min_replicas=1
    )

    # Wait for deployment
    assert endpoint.wait_until_ready(timeout=120)

    # Test prediction
    result = endpoint.predict({"text": "test"})
    assert "sentiment" in result

    # Cleanup
    endpoint.delete()
```

### Load Testing

```python
from concurrent.futures import ThreadPoolExecutor

def load_test(endpoint, num_requests=1000, concurrency=50):
    def make_request():
        return endpoint.predict({"text": "test"})

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(lambda _: make_request(), range(num_requests)))

    # Analyze results
    latencies = [r["inference_time_ms"] for r in results]
    print(f"P50 latency: {np.percentile(latencies, 50):.2f}ms")
    print(f"P99 latency: {np.percentile(latencies, 99):.2f}ms")
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] API keys stored in environment variables or secret manager
- [ ] Separate keys for dev/staging/production
- [ ] Input validation on all user-provided data
- [ ] Rate limiting on client side to prevent abuse
- [ ] HTTPS used for all requests
- [ ] Logging does not include PII or sensitive data
- [ ] Webhooks signatures verified
- [ ] Regular key rotation policy in place
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

---

## Additional Resources

- **[Getting Started Guide](./getting-started.md)**: Core concepts and first deployment
- **[API Reference](./api-reference.md)**: Complete API documentation
- **[Troubleshooting](./troubleshooting.md)**: Common issues and solutions
- **Example Projects**: [github.com/streaminfer/examples](https://github.com/streaminfer/examples)

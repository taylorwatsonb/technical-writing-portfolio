# Getting Started with StreamInfer

This guide walks you through StreamInfer's core concepts and helps you understand how to deploy and serve ML models effectively.

---

## Overview

StreamInfer is designed around a simple mental model: **you bring your trained model, we handle the infrastructure**. Behind the scenes, StreamInfer manages:

- **Containerization** of your model code and dependencies
- **Autoscaling** based on request volume and latency targets
- **Load balancing** across multiple model replicas
- **Version management** for safe model updates
- **Request/response handling** with automatic batching and optimization

Your job is to focus on model quality and application logic. StreamInfer handles the operational complexity.

---

## Prerequisites

Before you begin, you'll need:

- **Python 3.8+** or **Node.js 16+** (depending on your preferred SDK)
- **A trained ML model** in a supported format (ONNX, TensorFlow SavedModel, PyTorch, or custom)
- **A StreamInfer account** and API key

Don't have an account yet? Sign up at `app.streaminfer.com` and generate an API key from the dashboard.

---

## Core Concepts

### 1. Models vs. Endpoints

It's important to distinguish between these two concepts:

**Model**: Your trained machine learning artifact (e.g., `model.onnx`, `saved_model.pb`)

**Endpoint**: A deployed, live instance of your model that accepts HTTP requests

Think of a model as the blueprint, and an endpoint as the running service built from that blueprint. One model can power multiple endpoints, and one endpoint can serve multiple model versions.

### 2. Deployment Lifecycle

Every model deployment follows this lifecycle:

```
Local Model → Upload → Deploy → Endpoint URL → Inference Requests
```

1. **Upload**: Send your model file to StreamInfer
2. **Deploy**: Create an endpoint configuration (instance type, scaling rules, etc.)
3. **Ready**: StreamInfer provisions infrastructure and starts your model
4. **Serve**: Your endpoint receives and processes inference requests

Typical deployment time: **30-90 seconds** depending on model size and complexity.

### 3. Request Routing

When you make an inference request, StreamInfer:

1. Receives your HTTP request at the endpoint URL
2. Routes it to an available model replica
3. Batches it with other concurrent requests (if batching is enabled)
4. Runs inference on your model
5. Returns the prediction in the HTTP response

All of this happens in **milliseconds**, with automatic retries and failover if a replica becomes unhealthy.

---

## Your First Deployment

Let's walk through a complete example: deploying a sentiment analysis model.

### Step 1: Install the SDK

```bash
pip install streaminfer
```

### Step 2: Authenticate

```python
import streaminfer

client = streaminfer.Client(
    api_key="si_live_abc123..."  # Get this from app.streaminfer.com
)
```

**Best practice**: Store your API key in an environment variable:

```python
import os
import streaminfer

client = streaminfer.Client(
    api_key=os.environ["STREAMINFER_API_KEY"]
)
```

### Step 3: Deploy Your Model

```python
# Deploy an ONNX model
endpoint = client.deploy(
    model_path="./sentiment_model.onnx",
    endpoint_name="sentiment-v1",
    instance_type="gpu.t4.small",  # Specify hardware
    min_replicas=1,
    max_replicas=10
)

print(f"Endpoint deployed at: {endpoint.url}")
# Output: https://sentiment-v1.streaminfer.run
```

This single `deploy()` call:
- Uploads your model file
- Provisions a GPU instance
- Configures autoscaling (1-10 replicas)
- Returns when the endpoint is live and ready

### Step 4: Make Inference Requests

```python
# Single prediction
result = endpoint.predict({
    "text": "This movie was fantastic!"
})

print(result)
# {"sentiment": "positive", "score": 0.94}
```

```python
# Batch prediction (more efficient)
results = endpoint.predict_batch([
    {"text": "Great product, highly recommend"},
    {"text": "Terrible experience, very disappointed"},
    {"text": "It's okay, nothing special"}
])

for r in results:
    print(f"{r['text'][:30]}... -> {r['sentiment']}")
# Great product, highly recomm... -> positive
# Terrible experience, very di... -> negative
# It's okay, nothing special... -> neutral
```

---

## Understanding Endpoints

### Endpoint Properties

Every endpoint has:

- **URL**: A unique HTTPS endpoint (e.g., `https://my-model.streaminfer.run`)
- **Name**: A human-readable identifier
- **Status**: `deploying`, `active`, `failed`, or `stopped`
- **Versions**: One or more model versions (for A/B testing)
- **Metrics**: Request count, latency, error rate, etc.

### Listing Your Endpoints

```python
# Get all endpoints
endpoints = client.list_endpoints()

for ep in endpoints:
    print(f"{ep.name}: {ep.status} ({ep.request_count} requests)")
```

### Updating an Endpoint

Deploy a new version without downtime:

```python
# Deploy v2 of the model
endpoint.deploy_version(
    model_path="./sentiment_model_v2.onnx",
    version_name="v2",
    traffic_split={"v1": 90, "v2": 10}  # Gradual rollout
)
```

This sends 90% of traffic to v1 and 10% to v2, allowing you to validate the new version before fully switching over.

---

## Request and Response Format

### Request Schema

StreamInfer accepts JSON payloads in this format:

```json
{
  "instances": [
    {"feature1": "value1", "feature2": 123},
    {"feature1": "value2", "feature2": 456}
  ]
}
```

Or for single predictions:

```json
{
  "feature1": "value1",
  "feature2": 123
}
```

The schema is flexible and depends on your model's input requirements.

### Response Schema

Responses follow this structure:

```json
{
  "predictions": [
    {"class": "positive", "score": 0.94},
    {"class": "negative", "score": 0.78}
  ],
  "model_version": "v1",
  "inference_time_ms": 12.4
}
```

For single predictions, the response is unwrapped:

```json
{
  "class": "positive",
  "score": 0.94
}
```

---

## Monitoring Your Endpoint

StreamInfer provides built-in metrics for every endpoint:

```python
# Get endpoint metrics
metrics = endpoint.get_metrics(period="1h")

print(f"Requests: {metrics.request_count}")
print(f"P50 latency: {metrics.latency_p50}ms")
print(f"P99 latency: {metrics.latency_p99}ms")
print(f"Error rate: {metrics.error_rate}%")
```

You can also view these in the StreamInfer dashboard at `app.streaminfer.com`.

---

## Cleaning Up

When you're done testing, stop your endpoint to avoid charges:

```python
endpoint.stop()
```

This preserves your endpoint configuration but stops all running replicas. You can restart it later with:

```python
endpoint.start()
```

To permanently delete an endpoint:

```python
endpoint.delete()
```

---

## Cost Considerations

StreamInfer charges based on:

- **Compute time**: Per-second billing for active replicas
- **Request volume**: Free up to 1M requests/month, then $0.001 per request
- **Data transfer**: Free egress up to 100GB/month

**Cost optimization tips**:
- Use CPU instances for models with low latency requirements
- Set appropriate `min_replicas` (0 for dev, 1+ for production)
- Enable request batching to reduce compute time
- Use smaller instance types when possible

---

## What's Next?

Now that you understand the basics, explore:

- **[Quickstart](./quickstart.md)**: Deploy a sample model in under 5 minutes
- **[API Reference](./api-reference.md)**: Complete API documentation
- **[Python SDK Guide](./python-sdk.md)**: Advanced SDK usage and patterns
- **[Best Practices](./best-practices.md)**: Production deployment strategies

---

## Common Questions

### Can I deploy custom Python models?

Yes! StreamInfer supports custom Python models. You provide a `predict()` function and dependencies, and we handle the rest. See [Custom Models](./custom-models.md) for details.

### How do I handle authentication?

All requests to your endpoint require your API key in the `Authorization` header. See [API Reference](./api-reference.md#authentication) for details.

### What's the maximum request size?

10MB per request. For larger payloads (e.g., high-res images), use our [signed URL upload pattern](./best-practices.md#large-payloads).

### Can I run inference on my own infrastructure?

Yes, StreamInfer offers a self-hosted option for enterprise customers. Contact sales for details.

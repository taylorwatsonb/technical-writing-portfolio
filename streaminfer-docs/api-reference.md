# API Reference

Complete reference for the StreamInfer REST API.

---

## Base URL

```
https://api.streaminfer.com/v1
```

All API requests must be made over HTTPS. Requests made over HTTP will be redirected to HTTPS.

---

## Authentication

StreamInfer uses API keys for authentication. Include your API key in the `Authorization` header:

```
Authorization: Bearer si_live_abc123...
```

### Getting an API Key

1. Log in to [app.streaminfer.com](https://app.streaminfer.com)
2. Navigate to **Settings → API Keys**
3. Click **Create API Key**
4. Copy and securely store your key (it's only shown once)

### Example Request

```bash
curl https://api.streaminfer.com/v1/endpoints \
  -H "Authorization: Bearer si_live_abc123..."
```

**Security best practices**:
- Never commit API keys to version control
- Use environment variables or secret managers
- Rotate keys regularly
- Use separate keys for development and production

---

## Endpoints

### Deploy a Model

Create a new endpoint by deploying a model.

**POST** `/endpoints`

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Unique endpoint name (3-63 chars, lowercase, hyphens allowed) |
| `model_url` | string | Yes* | URL to model file (S3, GCS, or signed URL) |
| `model_file` | file | Yes* | Model file upload (multipart/form-data) |
| `instance_type` | string | No | Instance type (default: `cpu.small`) |
| `min_replicas` | integer | No | Minimum replicas (default: `1`) |
| `max_replicas` | integer | No | Maximum replicas (default: `10`) |
| `timeout_seconds` | integer | No | Request timeout (default: `60`) |

*Either `model_url` or `model_file` must be provided.

#### Instance Types

| Type | vCPU | RAM | GPU | Use Case |
|------|------|-----|-----|----------|
| `cpu.small` | 2 | 4 GB | - | Small models, low traffic |
| `cpu.medium` | 4 | 8 GB | - | Medium models, moderate traffic |
| `cpu.large` | 8 | 16 GB | - | Large models, high traffic |
| `gpu.t4.small` | 4 | 16 GB | T4 | GPU-accelerated inference |
| `gpu.a10.small` | 8 | 32 GB | A10 | Large GPU models |
| `gpu.a100.small` | 12 | 80 GB | A100 | Largest models, highest performance |

#### Example Request

```bash
curl -X POST https://api.streaminfer.com/v1/endpoints \
  -H "Authorization: Bearer si_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sentiment-classifier",
    "model_url": "s3://my-bucket/model.onnx",
    "instance_type": "cpu.medium",
    "min_replicas": 2,
    "max_replicas": 10
  }'
```

#### Response

```json
{
  "id": "ep_abc123",
  "name": "sentiment-classifier",
  "status": "deploying",
  "url": "https://sentiment-classifier.streaminfer.run",
  "instance_type": "cpu.medium",
  "min_replicas": 2,
  "max_replicas": 10,
  "created_at": "2025-10-26T10:30:00Z",
  "versions": [
    {
      "id": "v1",
      "status": "deploying",
      "traffic_percentage": 100
    }
  ]
}
```

**Status codes**:
- `201 Created`: Endpoint deployment initiated
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Missing or invalid API key
- `409 Conflict`: Endpoint name already exists
- `429 Too Many Requests`: Rate limit exceeded

---

### List Endpoints

Retrieve all endpoints in your account.

**GET** `/endpoints`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `deploying`, `active`, `failed`, `stopped` |
| `limit` | integer | Number of results (max: 100, default: 50) |
| `offset` | integer | Pagination offset (default: 0) |

#### Example Request

```bash
curl https://api.streaminfer.com/v1/endpoints?status=active&limit=10 \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "endpoints": [
    {
      "id": "ep_abc123",
      "name": "sentiment-classifier",
      "status": "active",
      "url": "https://sentiment-classifier.streaminfer.run",
      "instance_type": "cpu.medium",
      "min_replicas": 2,
      "max_replicas": 10,
      "created_at": "2025-10-26T10:30:00Z",
      "updated_at": "2025-10-26T10:32:15Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### Get Endpoint Details

Retrieve details about a specific endpoint.

**GET** `/endpoints/{endpoint_id}`

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `endpoint_id` | string | Endpoint ID (e.g., `ep_abc123`) or name |

#### Example Request

```bash
curl https://api.streaminfer.com/v1/endpoints/ep_abc123 \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "id": "ep_abc123",
  "name": "sentiment-classifier",
  "status": "active",
  "url": "https://sentiment-classifier.streaminfer.run",
  "instance_type": "cpu.medium",
  "min_replicas": 2,
  "max_replicas": 10,
  "created_at": "2025-10-26T10:30:00Z",
  "updated_at": "2025-10-26T10:32:15Z",
  "versions": [
    {
      "id": "v1",
      "status": "active",
      "traffic_percentage": 100,
      "created_at": "2025-10-26T10:30:00Z"
    }
  ],
  "metrics": {
    "request_count_24h": 15420,
    "error_rate_24h": 0.02,
    "latency_p50_ms": 12.4,
    "latency_p99_ms": 45.8
  }
}
```

---

### Update Endpoint Configuration

Update an endpoint's scaling or instance configuration.

**PATCH** `/endpoints/{endpoint_id}`

#### Request Body

| Parameter | Type | Description |
|-----------|------|-------------|
| `min_replicas` | integer | Minimum replicas |
| `max_replicas` | integer | Maximum replicas |
| `timeout_seconds` | integer | Request timeout |

**Note**: You cannot change `instance_type` after deployment. Create a new endpoint instead.

#### Example Request

```bash
curl -X PATCH https://api.streaminfer.com/v1/endpoints/ep_abc123 \
  -H "Authorization: Bearer si_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "min_replicas": 5,
    "max_replicas": 20
  }'
```

#### Response

```json
{
  "id": "ep_abc123",
  "name": "sentiment-classifier",
  "status": "active",
  "min_replicas": 5,
  "max_replicas": 20,
  "updated_at": "2025-10-26T11:15:00Z"
}
```

---

### Stop Endpoint

Stop all replicas for an endpoint (preserves configuration).

**POST** `/endpoints/{endpoint_id}/stop`

#### Example Request

```bash
curl -X POST https://api.streaminfer.com/v1/endpoints/ep_abc123/stop \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "id": "ep_abc123",
  "status": "stopped",
  "message": "Endpoint stopped. Restart with POST /endpoints/ep_abc123/start"
}
```

---

### Start Endpoint

Restart a stopped endpoint.

**POST** `/endpoints/{endpoint_id}/start`

#### Example Request

```bash
curl -X POST https://api.streaminfer.com/v1/endpoints/ep_abc123/start \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "id": "ep_abc123",
  "status": "deploying",
  "message": "Endpoint starting. Status will change to 'active' when ready."
}
```

---

### Delete Endpoint

Permanently delete an endpoint and all its data.

**DELETE** `/endpoints/{endpoint_id}`

#### Example Request

```bash
curl -X DELETE https://api.streaminfer.com/v1/endpoints/ep_abc123 \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "id": "ep_abc123",
  "message": "Endpoint deleted successfully",
  "deleted_at": "2025-10-26T12:00:00Z"
}
```

**Warning**: This action is irreversible. All metrics and logs will be deleted.

---

### Make an Inference Request

Send data to your model for prediction.

**POST** `https://{endpoint_name}.streaminfer.run/predict`

**Note**: Inference requests go to the endpoint URL, not the API base URL.

#### Request Body

The request body format depends on your model's input schema. StreamInfer supports:

**Single prediction**:
```json
{
  "text": "This product is amazing!",
  "metadata": {"user_id": "123"}
}
```

**Batch prediction**:
```json
{
  "instances": [
    {"text": "Great product!"},
    {"text": "Terrible experience."}
  ]
}
```

#### Example Request

```bash
curl -X POST https://sentiment-classifier.streaminfer.run/predict \
  -H "Authorization: Bearer si_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love this product!"
  }'
```

#### Response

```json
{
  "sentiment": "positive",
  "confidence": 0.94,
  "model_version": "v1",
  "inference_time_ms": 8.2
}
```

**For batch requests**:
```json
{
  "predictions": [
    {"sentiment": "positive", "confidence": 0.94},
    {"sentiment": "negative", "confidence": 0.87}
  ],
  "model_version": "v1",
  "inference_time_ms": 12.5
}
```

**Status codes**:
- `200 OK`: Prediction successful
- `400 Bad Request`: Invalid input format
- `401 Unauthorized`: Missing or invalid API key
- `413 Payload Too Large`: Request exceeds 10MB limit
- `500 Internal Server Error`: Model inference failed
- `503 Service Unavailable`: No healthy replicas available

---

### Get Endpoint Metrics

Retrieve performance metrics for an endpoint.

**GET** `/endpoints/{endpoint_id}/metrics`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period: `1h`, `24h`, `7d`, `30d` (default: `24h`) |
| `granularity` | string | Data granularity: `1m`, `5m`, `1h` (default: auto) |

#### Example Request

```bash
curl https://api.streaminfer.com/v1/endpoints/ep_abc123/metrics?period=7d \
  -H "Authorization: Bearer si_live_abc123..."
```

#### Response

```json
{
  "endpoint_id": "ep_abc123",
  "period": "7d",
  "metrics": {
    "request_count": 1045823,
    "error_count": 412,
    "error_rate": 0.039,
    "latency_avg_ms": 15.3,
    "latency_p50_ms": 12.1,
    "latency_p95_ms": 28.4,
    "latency_p99_ms": 52.7,
    "active_replicas_avg": 3.2,
    "active_replicas_max": 8
  },
  "timeseries": [
    {
      "timestamp": "2025-10-20T00:00:00Z",
      "request_count": 142340,
      "error_rate": 0.02,
      "latency_p50_ms": 11.8
    },
    {
      "timestamp": "2025-10-21T00:00:00Z",
      "request_count": 156892,
      "error_rate": 0.03,
      "latency_p50_ms": 12.3
    }
  ]
}
```

---

### Deploy Model Version

Deploy a new version of your model to an existing endpoint.

**POST** `/endpoints/{endpoint_id}/versions`

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version_name` | string | Yes | Version identifier (e.g., `v2`, `prod-oct-26`) |
| `model_url` | string | Yes* | URL to model file |
| `model_file` | file | Yes* | Model file upload |
| `traffic_percentage` | integer | No | Initial traffic % (default: `0`) |

#### Example Request

```bash
curl -X POST https://api.streaminfer.com/v1/endpoints/ep_abc123/versions \
  -H "Authorization: Bearer si_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "version_name": "v2",
    "model_url": "s3://my-bucket/model_v2.onnx",
    "traffic_percentage": 10
  }'
```

#### Response

```json
{
  "endpoint_id": "ep_abc123",
  "version": {
    "id": "v2",
    "status": "deploying",
    "traffic_percentage": 10,
    "created_at": "2025-10-26T13:00:00Z"
  },
  "traffic_split": {
    "v1": 90,
    "v2": 10
  }
}
```

---

### Update Traffic Split

Adjust traffic distribution between model versions.

**PUT** `/endpoints/{endpoint_id}/traffic`

#### Request Body

```json
{
  "traffic_split": {
    "v1": 20,
    "v2": 80
  }
}
```

Traffic percentages must sum to 100.

#### Example Request

```bash
curl -X PUT https://api.streaminfer.com/v1/endpoints/ep_abc123/traffic \
  -H "Authorization: Bearer si_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "traffic_split": {
      "v1": 0,
      "v2": 100
    }
  }'
```

#### Response

```json
{
  "endpoint_id": "ep_abc123",
  "traffic_split": {
    "v1": 0,
    "v2": 100
  },
  "updated_at": "2025-10-26T14:00:00Z"
}
```

**Use case**: Gradually roll out new model versions (canary deployment):
1. Deploy v2 with 0% traffic
2. Increase to 10% and monitor metrics
3. If metrics look good, increase to 50%, then 100%
4. If issues arise, roll back to v1 instantly

---

## Error Handling

### Error Response Format

All errors return a JSON response with this structure:

```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "Endpoint name must be 3-63 characters",
    "code": "invalid_endpoint_name",
    "param": "name"
  }
}
```

### Error Types

| Type | Description | HTTP Status |
|------|-------------|-------------|
| `invalid_request_error` | Invalid parameters or request format | 400 |
| `authentication_error` | Missing or invalid API key | 401 |
| `permission_error` | Insufficient permissions | 403 |
| `not_found_error` | Resource doesn't exist | 404 |
| `rate_limit_error` | Too many requests | 429 |
| `server_error` | Internal server error | 500 |

### Common Error Codes

| Code | Message | Resolution |
|------|---------|------------|
| `invalid_api_key` | Invalid API key provided | Check your API key |
| `endpoint_not_found` | Endpoint does not exist | Verify endpoint ID |
| `model_inference_failed` | Model failed to process request | Check model logs |
| `payload_too_large` | Request exceeds size limit | Reduce payload size |
| `rate_limit_exceeded` | Too many requests | Slow down request rate |

---

## Rate Limits

StreamInfer enforces these rate limits:

| Tier | Requests/second | Burst |
|------|----------------|-------|
| Free | 10 | 20 |
| Pro | 100 | 200 |
| Enterprise | Custom | Custom |

**Rate limit headers** are included in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698345600
```

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Retry after 5 seconds.",
    "retry_after_seconds": 5
  }
}
```

**Best practices**:
- Implement exponential backoff when you receive 429 responses
- Use batch predictions instead of many single requests
- Cache predictions when appropriate
- Upgrade to a higher tier if you consistently hit limits

---

## Pagination

List endpoints that return multiple results use cursor-based pagination:

```bash
curl "https://api.streaminfer.com/v1/endpoints?limit=50&offset=0"
```

Response includes pagination metadata:

```json
{
  "endpoints": [...],
  "total": 156,
  "limit": 50,
  "offset": 0,
  "has_more": true,
  "next_offset": 50
}
```

To fetch the next page:

```bash
curl "https://api.streaminfer.com/v1/endpoints?limit=50&offset=50"
```

---

## Webhooks

StreamInfer can send webhook events when important endpoint events occur.

### Configuring Webhooks

**POST** `/webhooks`

```json
{
  "url": "https://your-app.com/webhooks/streaminfer",
  "events": ["endpoint.deployed", "endpoint.failed", "endpoint.scaled"],
  "secret": "your_webhook_secret"
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `endpoint.deployed` | Endpoint successfully deployed |
| `endpoint.failed` | Endpoint deployment failed |
| `endpoint.scaled` | Replicas added or removed |
| `version.deployed` | New model version deployed |
| `high_error_rate` | Error rate exceeds 5% for 5 minutes |

### Webhook Payload Example

```json
{
  "event": "endpoint.scaled",
  "timestamp": "2025-10-26T15:30:00Z",
  "data": {
    "endpoint_id": "ep_abc123",
    "endpoint_name": "sentiment-classifier",
    "old_replicas": 2,
    "new_replicas": 5,
    "reason": "high_request_volume"
  }
}
```

### Verifying Webhooks

StreamInfer signs webhook payloads with HMAC-SHA256. Verify signatures to ensure requests are authentic:

```python
import hmac
import hashlib

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# In your webhook handler
signature = request.headers["X-StreamInfer-Signature"]
is_valid = verify_webhook(request.body, signature, webhook_secret)
```

---

## SDKs

While you can use the REST API directly, StreamInfer provides official SDKs for convenience:

- **Python**: `pip install streaminfer`
- **JavaScript/TypeScript**: `npm install @streaminfer/sdk`
- **Go**: `go get github.com/streaminfer/streaminfer-go`

See the [Python SDK Guide](./python-sdk.md) for detailed SDK documentation.

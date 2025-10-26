# Quickstart: Deploy Your First Model

Deploy a machine learning model to production in under 5 minutes.

---

## What You'll Build

In this quickstart, you'll:

1. Install the StreamInfer SDK
2. Deploy a pre-trained sentiment analysis model
3. Make your first inference request
4. Monitor your endpoint

**Time to complete**: ~5 minutes

---

## Prerequisites

- Python 3.8 or later
- A StreamInfer API key ([get one here](https://app.streaminfer.com/api-keys))

---

## Step 1: Install the SDK

```bash
pip install streaminfer
```

Verify installation:

```bash
python -c "import streaminfer; print(streaminfer.__version__)"
# Output: 1.4.2
```

---

## Step 2: Set Your API Key

```bash
export STREAMINFER_API_KEY="si_live_your_key_here"
```

Or add it to your `~/.bashrc` or `~/.zshrc` for persistence.

---

## Step 3: Deploy a Sample Model

Create a file `deploy.py`:

```python
import streaminfer

# Initialize client
client = streaminfer.Client()

# Deploy a pre-trained sentiment model
endpoint = client.deploy(
    model="streaminfer/sentiment-analysis",  # Public model
    endpoint_name="my-first-endpoint",
    instance_type="cpu.small"
)

print(f"✓ Endpoint deployed: {endpoint.url}")
print(f"✓ Status: {endpoint.status}")
```

Run it:

```bash
python deploy.py
```

Output:
```
Uploading model... ✓
Provisioning infrastructure... ✓
Starting endpoint... ✓
✓ Endpoint deployed: https://my-first-endpoint.streaminfer.run
✓ Status: active
```

This takes **30-60 seconds**. StreamInfer handles containerization, infrastructure provisioning, and health checks automatically.

---

## Step 4: Make an Inference Request

Create `predict.py`:

```python
import streaminfer

client = streaminfer.Client()
endpoint = client.get_endpoint("my-first-endpoint")

# Single prediction
result = endpoint.predict({
    "text": "I absolutely loved this product!"
})

print(result)
```

Run it:

```bash
python predict.py
```

Output:
```json
{
  "sentiment": "positive",
  "confidence": 0.97,
  "inference_time_ms": 8.2
}
```

---

## Step 5: Try Batch Predictions

Batch requests are more efficient for processing multiple inputs:

```python
import streaminfer

client = streaminfer.Client()
endpoint = client.get_endpoint("my-first-endpoint")

# Batch prediction
texts = [
    "This is amazing!",
    "Worst experience ever.",
    "It's okay, nothing special.",
    "Highly recommend this!"
]

results = endpoint.predict_batch([{"text": t} for t in texts])

for text, result in zip(texts, results):
    print(f"{text:30} -> {result['sentiment']:8} ({result['confidence']:.2f})")
```

Output:
```
This is amazing!               -> positive (0.98)
Worst experience ever.         -> negative (0.95)
It's okay, nothing special.    -> neutral  (0.87)
Highly recommend this!         -> positive (0.96)
```

---

## Step 6: Monitor Your Endpoint

Check real-time metrics:

```python
import streaminfer

client = streaminfer.Client()
endpoint = client.get_endpoint("my-first-endpoint")

metrics = endpoint.get_metrics(period="1h")

print(f"Requests (last hour): {metrics.request_count}")
print(f"Average latency: {metrics.latency_avg:.1f}ms")
print(f"Error rate: {metrics.error_rate:.2f}%")
print(f"Active replicas: {metrics.active_replicas}")
```

Output:
```
Requests (last hour): 42
Average latency: 9.3ms
Error rate: 0.00%
Active replicas: 1
```

---

## Step 7: Clean Up

Stop your endpoint to avoid charges:

```python
import streaminfer

client = streaminfer.Client()
endpoint = client.get_endpoint("my-first-endpoint")

endpoint.stop()
print("✓ Endpoint stopped")
```

Your endpoint configuration is preserved. Restart anytime with `endpoint.start()`.

---

## Making HTTP Requests (without SDK)

You can also call your endpoint directly via HTTP:

```bash
curl -X POST https://my-first-endpoint.streaminfer.run/predict \
  -H "Authorization: Bearer si_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is great!"}'
```

Response:
```json
{
  "sentiment": "positive",
  "confidence": 0.94
}
```

This is useful for integrating with any programming language or tool that can make HTTP requests.

---

## What You've Learned

In this quickstart, you:

- ✓ Deployed a model to a production endpoint
- ✓ Made single and batch inference requests
- ✓ Monitored endpoint performance
- ✓ Managed endpoint lifecycle (stop/start)

---

## Next Steps

### Deploy Your Own Model

Instead of using a pre-trained model, deploy your own:

```python
endpoint = client.deploy(
    model_path="./my_model.onnx",  # Local model file
    endpoint_name="my-custom-model",
    instance_type="gpu.t4.small"   # Use GPU for faster inference
)
```

Supported formats: ONNX, TensorFlow SavedModel, PyTorch, scikit-learn, custom Python.

### Configure Autoscaling

Automatically scale based on request volume:

```python
endpoint = client.deploy(
    model="streaminfer/sentiment-analysis",
    endpoint_name="production-endpoint",
    min_replicas=2,      # Always keep 2 replicas running
    max_replicas=20,     # Scale up to 20 under high load
    target_latency_ms=50 # Scale up if latency exceeds 50ms
)
```

StreamInfer automatically adds/removes replicas to maintain your target latency.

### Enable Request Caching

Cache identical requests for even lower latency:

```python
endpoint.update_config(
    enable_cache=True,
    cache_ttl_seconds=300  # Cache results for 5 minutes
)
```

### A/B Test Model Versions

Deploy multiple versions and split traffic:

```python
# Deploy version 2
endpoint.deploy_version(
    model_path="./model_v2.onnx",
    version_name="v2"
)

# Split traffic: 80% to v1, 20% to v2
endpoint.set_traffic_split({
    "v1": 80,
    "v2": 20
})
```

Compare metrics between versions to validate improvements before fully rolling out v2.

---

## Learn More

- **[Getting Started Guide](./getting-started.md)**: Deep dive into core concepts
- **[API Reference](./api-reference.md)**: Complete API documentation
- **[Python SDK Guide](./python-sdk.md)**: Advanced SDK patterns and examples
- **[Best Practices](./best-practices.md)**: Production deployment strategies
- **[Troubleshooting](./troubleshooting.md)**: Common issues and solutions

---

## Need Help?

- **Documentation**: You're already here!
- **Examples**: Check out [example projects on GitHub](https://github.com/streaminfer/examples)
- **Support**: Email support@streaminfer.com or use the in-app chat

Happy deploying!

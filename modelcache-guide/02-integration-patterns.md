# Part 2: Integration Patterns

Learn how to integrate ModelCache with popular ML frameworks and serving platforms.

---

## Overview

This tutorial covers integration patterns for:

1. **TensorFlow Serving** - Caching TF models served via gRPC/REST
2. **PyTorch** - Caching custom PyTorch models
3. **FastAPI** - Adding caching to REST API endpoints
4. **SageMaker** - Caching predictions from AWS SageMaker endpoints
5. **Hugging Face Transformers** - Caching large language model outputs
6. **ONNX Runtime** - Caching ONNX model inference

Each section includes complete working examples.

---

## Integration 1: TensorFlow Serving

TensorFlow Serving exposes models via REST or gRPC. We'll add a caching layer in front.

### Architecture

```
Client Request
      ↓
  ModelCache
      ↓ (cache miss)
TensorFlow Serving
      ↓
    Model
```

### Implementation

```python
# tf_serving_cached.py
import requests
import json
from modelcache import Cache
from modelcache.backends import RedisBackend

# Initialize cache
cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="tfserving"
)

class TFServingClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def _generate_cache_key(self, model_name: str, inputs: dict) -> str:
        """Create deterministic key from model name and inputs."""
        inputs_str = json.dumps(inputs, sort_keys=True)
        return f"{model_name}:{hash(inputs_str)}"

    @cache.cached(
        key_func=lambda self, model_name, inputs:
            self._generate_cache_key(model_name, inputs)
    )
    def predict(self, model_name: str, inputs: dict) -> dict:
        """Make prediction with caching."""
        url = f"{self.base_url}/v1/models/{model_name}:predict"

        response = requests.post(
            url,
            json={"instances": [inputs]},
            timeout=30
        )
        response.raise_for_status()

        return response.json()["predictions"][0]

# Usage
client = TFServingClient(base_url="http://localhost:8501")

# First call: cache miss, hits TF Serving
result = client.predict(
    model_name="resnet",
    inputs={"image": image_data}
)

# Second call: cache hit, returns instantly
result = client.predict(
    model_name="resnet",
    inputs={"image": image_data}
)
```

### Advanced: Version-Aware Caching

Cache different model versions separately:

```python
@cache.cached(
    key_func=lambda self, model_name, version, inputs:
        f"{model_name}:v{version}:{hash(json.dumps(inputs, sort_keys=True))}"
)
def predict(self, model_name: str, version: int, inputs: dict) -> dict:
    url = f"{self.base_url}/v1/models/{model_name}/versions/{version}:predict"
    # ... rest of implementation
```

### Batch Request Optimization

```python
def predict_batch(self, model_name: str, inputs_list: list[dict]) -> list[dict]:
    """Predict with batch cache lookup."""
    results = []
    uncached_inputs = []
    uncached_indices = []

    # Check cache for each input
    for i, inputs in enumerate(inputs_list):
        key = self._generate_cache_key(model_name, inputs)
        cached = cache.get(key)

        if cached:
            results.append(cached)
        else:
            uncached_inputs.append(inputs)
            uncached_indices.append(i)

    # Batch request for cache misses
    if uncached_inputs:
        url = f"{self.base_url}/v1/models/{model_name}:predict"
        response = requests.post(url, json={"instances": uncached_inputs})
        predictions = response.json()["predictions"]

        # Cache and merge results
        for idx, pred in zip(uncached_indices, predictions):
            key = self._generate_cache_key(model_name, inputs_list[idx])
            cache.set(key, pred)
            results.insert(idx, pred)

    return results
```

---

## Integration 2: PyTorch

Integrate caching directly into PyTorch model inference.

### Basic Pattern

```python
# pytorch_cached.py
import torch
from modelcache import Cache
from modelcache.backends import RedisBackend

cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="pytorch"
)

class CachedModel:
    def __init__(self, model_path: str):
        self.model = torch.load(model_path)
        self.model.eval()

    def _input_to_key(self, x: torch.Tensor) -> str:
        """Convert tensor to cache key."""
        # Use tensor hash (fast but not collision-free)
        return f"tensor:{hash(x.cpu().numpy().tobytes())}"

    @cache.cached(
        key_func=lambda self, x: self._input_to_key(x),
        serialize_func=lambda x: x.cpu().numpy().tobytes(),  # How to store
        deserialize_func=lambda b: torch.from_numpy(np.frombuffer(b))  # How to load
    )
    def predict(self, x: torch.Tensor) -> torch.Tensor:
        """Run inference with caching."""
        with torch.no_grad():
            return self.model(x)

# Usage
model = CachedModel("resnet50.pth")

# First call: runs inference
output = model.predict(image_tensor)  # 50ms

# Second call: cache hit
output = model.predict(image_tensor)  # 2ms
```

### Handling GPU Tensors

```python
def _serialize_tensor(tensor: torch.Tensor) -> bytes:
    """Serialize GPU/CPU tensors."""
    return tensor.cpu().numpy().tobytes()

def _deserialize_tensor(data: bytes, device: str = "cuda") -> torch.Tensor:
    """Deserialize to specified device."""
    tensor = torch.from_numpy(np.frombuffer(data))
    return tensor.to(device)

@cache.cached(
    key_func=lambda self, x: hash(x.cpu().numpy().tobytes()),
    serialize_func=_serialize_tensor,
    deserialize_func=lambda b: _deserialize_tensor(b, device="cuda:0")
)
def predict(self, x: torch.Tensor) -> torch.Tensor:
    return self.model(x)
```

### Caching Embeddings

```python
class EmbeddingModel:
    """Cache text embeddings from a transformer model."""

    def __init__(self, model_name: str):
        from transformers import AutoModel, AutoTokenizer

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)

    @cache.cached(
        key_func=lambda self, text: f"embed:{hash(text)}",
        ttl_seconds=86400  # Embeddings are stable, cache 24h
    )
    def embed(self, text: str) -> np.ndarray:
        """Get embedding with caching."""
        inputs = self.tokenizer(text, return_tensors="pt")
        outputs = self.model(**inputs)

        # Return CLS token embedding
        return outputs.last_hidden_state[:, 0, :].detach().numpy()

# Usage
embedder = EmbeddingModel("bert-base-uncased")

# First call: runs transformer
emb = embedder.embed("Hello world")  # 120ms

# Second call: cached
emb = embedder.embed("Hello world")  # 2ms
```

---

## Integration 3: FastAPI

Add caching to REST API endpoints serving ML models.

### Basic FastAPI Integration

```python
# fastapi_app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from modelcache import Cache
from modelcache.backends import RedisBackend
import pickle

app = FastAPI()

# Initialize cache
cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="api"
)

# Load model
with open("model.pkl", "rb") as f:
    model = pickle.load(f)

class PredictionRequest(BaseModel):
    text: str
    user_id: str = None

class PredictionResponse(BaseModel):
    sentiment: str
    confidence: float
    cached: bool

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict sentiment with caching."""

    # Generate cache key
    cache_key = f"sentiment:{hash(request.text)}"

    # Check cache
    cached_result = cache.get(cache_key)
    if cached_result:
        return PredictionResponse(**cached_result, cached=True)

    # Cache miss: run inference
    prediction = model.predict([request.text])[0]
    confidence = model.predict_proba([request.text])[0].max()

    result = {
        "sentiment": prediction,
        "confidence": float(confidence)
    }

    # Store in cache
    cache.set(cache_key, result)

    return PredictionResponse(**result, cached=False)

# Run with: uvicorn fastapi_app:app --reload
```

### Decorator-Based Approach

```python
from functools import wraps

def cached_endpoint(cache_key_func):
    """Decorator for caching FastAPI endpoints."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = cache_key_func(*args, **kwargs)

            # Check cache
            cached = cache.get(key)
            if cached:
                return cached

            # Execute endpoint
            result = await func(*args, **kwargs)

            # Cache result
            cache.set(key, result)

            return result

        return wrapper
    return decorator

# Usage
@app.post("/predict")
@cached_endpoint(lambda req: f"pred:{hash(req.text)}")
async def predict(request: PredictionRequest):
    # Just implement logic, caching handled by decorator
    return {
        "sentiment": model.predict([request.text])[0],
        "confidence": model.predict_proba([request.text])[0].max()
    }
```

### User-Specific Caching

```python
@app.post("/recommend")
@cached_endpoint(
    lambda req: f"rec:{req.user_id}:{req.context}:{hash(req.items)}"
)
async def recommend(request: RecommendationRequest):
    """User-specific recommendations with caching."""
    recommendations = recommendation_model.predict(
        user_id=request.user_id,
        context=request.context,
        items=request.items
    )
    return {"recommendations": recommendations}

# Different users get different cache entries
# Same user + context + items = cached result
```

### Cache Invalidation Endpoint

```python
@app.delete("/cache")
async def clear_cache(pattern: str = "*"):
    """Clear cache entries matching pattern."""
    count = cache.invalidate(pattern=pattern)
    return {"cleared": count}

# Usage:
# DELETE /cache?pattern=sentiment:*  (clear all sentiment predictions)
# DELETE /cache?pattern=rec:user_123:*  (clear user's recommendations)
```

---

## Integration 4: AWS SageMaker

Cache predictions from SageMaker real-time endpoints.

### Implementation

```python
# sagemaker_cached.py
import boto3
import json
from modelcache import Cache
from modelcache.backends import RedisBackend

cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="sagemaker"
)

class CachedSageMakerClient:
    def __init__(self, endpoint_name: str, region: str = "us-east-1"):
        self.endpoint_name = endpoint_name
        self.runtime = boto3.client("sagemaker-runtime", region_name=region)

    @cache.cached(
        key_func=lambda self, data: f"{self.endpoint_name}:{hash(json.dumps(data, sort_keys=True))}"
    )
    def predict(self, data: dict) -> dict:
        """Invoke SageMaker endpoint with caching."""
        response = self.runtime.invoke_endpoint(
            EndpointName=self.endpoint_name,
            ContentType="application/json",
            Body=json.dumps(data)
        )

        result = json.loads(response["Body"].read())
        return result

# Usage
client = CachedSageMakerClient(endpoint_name="my-model-endpoint")

# First call: invokes SageMaker (100-500ms + network)
result = client.predict({"text": "Hello world"})

# Second call: cached (2-5ms)
result = client.predict({"text": "Hello world"})
```

### Multi-Model Endpoint Caching

```python
class MultiModelSageMakerClient:
    """Cache predictions from SageMaker multi-model endpoints."""

    def __init__(self, endpoint_name: str):
        self.endpoint_name = endpoint_name
        self.runtime = boto3.client("sagemaker-runtime")

    @cache.cached(
        key_func=lambda self, model_name, data:
            f"{self.endpoint_name}:{model_name}:{hash(json.dumps(data, sort_keys=True))}"
    )
    def predict(self, model_name: str, data: dict) -> dict:
        """Predict from specific model on multi-model endpoint."""
        response = self.runtime.invoke_endpoint(
            EndpointName=self.endpoint_name,
            TargetModel=model_name,  # Specify which model
            ContentType="application/json",
            Body=json.dumps(data)
        )
        return json.loads(response["Body"].read())
```

---

## Integration 5: Hugging Face Transformers

Cache outputs from large language models.

### Text Generation

```python
from transformers import pipeline
from modelcache import Cache
from modelcache.backends import RedisBackend

cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=86400,  # 24 hours
    namespace="hf"
)

class CachedGenerator:
    def __init__(self, model_name: str = "gpt2"):
        self.generator = pipeline("text-generation", model=model_name)

    @cache.cached(
        key_func=lambda self, prompt, max_length:
            f"gen:{hash(prompt)}:{max_length}"
    )
    def generate(self, prompt: str, max_length: int = 50) -> str:
        """Generate text with caching."""
        result = self.generator(
            prompt,
            max_length=max_length,
            num_return_sequences=1
        )
        return result[0]["generated_text"]

# Usage
generator = CachedGenerator(model_name="gpt2")

# First call: runs LLM (2-5 seconds)
text = generator.generate("Once upon a time", max_length=100)

# Second call: cached (2ms)
text = generator.generate("Once upon a time", max_length=100)
```

**Important**: Only cache deterministic generations. Disable sampling for caching:

```python
result = self.generator(
    prompt,
    max_length=max_length,
    do_sample=False,  # Deterministic
    num_beams=1
)
```

### Question Answering

```python
class CachedQA:
    def __init__(self):
        self.qa = pipeline("question-answering")

    @cache.cached(
        key_func=lambda self, question, context:
            f"qa:{hash(question)}:{hash(context)}"
    )
    def answer(self, question: str, context: str) -> dict:
        """Answer question with caching."""
        return self.qa(question=question, context=context)

# Usage
qa = CachedQA()

context = "Paris is the capital of France. It has a population of 2.2 million."

# First call: runs BERT (200-500ms)
answer = qa.answer("What is the capital of France?", context)

# Second call: cached (2ms)
answer = qa.answer("What is the capital of France?", context)
```

---

## Integration 6: ONNX Runtime

Cache ONNX model predictions.

```python
# onnx_cached.py
import onnxruntime as ort
import numpy as np
from modelcache import Cache
from modelcache.backends import RedisBackend

cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="onnx"
)

class CachedONNXModel:
    def __init__(self, model_path: str):
        self.session = ort.InferenceSession(model_path)
        self.input_name = self.session.get_inputs()[0].name

    def _input_to_key(self, input_data: np.ndarray) -> str:
        """Convert numpy array to cache key."""
        return f"onnx:{hash(input_data.tobytes())}"

    @cache.cached(
        key_func=lambda self, input_data: self._input_to_key(input_data),
        serialize_func=lambda x: x[0].tobytes(),  # Serialize numpy array
        deserialize_func=lambda b: [np.frombuffer(b)]  # Deserialize
    )
    def predict(self, input_data: np.ndarray) -> np.ndarray:
        """Run ONNX inference with caching."""
        outputs = self.session.run(None, {self.input_name: input_data})
        return outputs[0]

# Usage
model = CachedONNXModel("model.onnx")

input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)

# First call: runs ONNX (20-100ms)
output = model.predict(input_data)

# Second call: cached (2ms)
output = model.predict(input_data)
```

---

## Comparison Table

| Framework | Cache Hit Latency | Typical Speedup | Best For |
|-----------|-------------------|-----------------|----------|
| TensorFlow Serving | 2-5ms | 10-50x | Production deployments |
| PyTorch | 1-3ms | 20-100x | Custom models |
| FastAPI | 2-5ms | 10-100x | REST APIs |
| SageMaker | 5-10ms | 20-100x | AWS-native |
| Hugging Face | 2-5ms | 100-1000x | LLMs, transformers |
| ONNX | 1-3ms | 10-50x | Optimized inference |

---

## Next Steps

Continue to:

**[Part 3: Cache Key Design](./03-cache-key-design.md)**
Learn advanced cache key strategies for complex use cases.

**[Part 4: Cache Invalidation Strategies](./04-invalidation-strategies.md)**
Implement smart invalidation to keep predictions fresh.

**[Configuration Reference](./configuration-reference.md)**
Explore all configuration options for fine-tuning.

---

## Summary

You learned how to integrate ModelCache with:
- ✅ TensorFlow Serving (REST/gRPC)
- ✅ PyTorch (custom models, embeddings)
- ✅ FastAPI (REST API endpoints)
- ✅ AWS SageMaker (managed endpoints)
- ✅ Hugging Face Transformers (LLMs, QA)
- ✅ ONNX Runtime (optimized models)

**Key pattern**: Wrap your inference function with `@cache.cached` and define a cache key function.

# Part 1: Getting Started with ModelCache

Learn the fundamentals of ModelCache and implement your first cached model.

---

## What You'll Learn

By the end of this tutorial, you'll be able to:

- Install and configure ModelCache
- Understand core caching concepts (TTL, eviction, cache keys)
- Implement caching for a simple ML model
- Monitor cache performance
- Debug cache issues

**Estimated time**: 30 minutes

---

## Prerequisites

- Python 3.8 or later
- A trained ML model (we'll use scikit-learn in examples, but any framework works)
- Redis installed locally (for production-like testing)

**Install Redis** (if needed):

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Docker (any OS)
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Installation

Install ModelCache and Redis client:

```bash
pip install modelcache[redis]
```

This installs:
- `modelcache`: Core library
- `redis`: Redis backend support
- `hiredis`: Fast Redis protocol parser

**Verify installation**:

```bash
python -c "import modelcache; print(modelcache.__version__)"
# Output: 2.1.0
```

---

## Core Concepts

Before writing code, let's understand the key concepts.

### 1. Cache Backends

A **backend** is where cached data is stored. ModelCache supports several backends:

- **Redis**: Recommended for production (distributed, fast, persistent)
- **Memcached**: Simpler, faster for pure caching (not persistent)
- **In-Memory**: Fast but limited to single process (good for development)
- **Database**: PostgreSQL, MySQL (persistent, queryable)

For this tutorial, we'll use **Redis** because it's production-ready and easy to set up.

### 2. Cache Keys

A **cache key** uniquely identifies a cached prediction. For example:

- User recommendation: `"recommend:user_123:context_work"`
- Image classification: `"classify:image_abc123"`
- Sentiment analysis: `"sentiment:sha256(text)"`

**Good cache keys** are:
- Deterministic (same input = same key)
- Unique (different inputs = different keys)
- Concise (shorter is faster)

### 3. Time-to-Live (TTL)

**TTL** determines how long a cached item remains valid. After TTL expires, the item is evicted.

Example TTLs:
- Product recommendations: 1 hour (updates frequently)
- Historical data analysis: 24 hours (rarely changes)
- Static content classification: 7 days (nearly immutable)

**Trade-off**: Longer TTL = better cache hit rate but potentially stale data.

### 4. Cache Eviction

When the cache fills up, **eviction policies** determine what to remove:

- **LRU (Least Recently Used)**: Remove items accessed longest ago (default)
- **LFU (Least Frequently Used)**: Remove items accessed least often
- **TTL-based**: Remove expired items first

Redis handles this automatically when you set `maxmemory-policy`.

---

## Your First Cached Model

Let's cache a simple sentiment analysis model.

### Step 1: Train a Simple Model

```python
# train_model.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
import pickle

# Training data
texts = [
    "I love this product!",
    "Terrible experience, very disappointed",
    "It's okay, nothing special",
    "Absolutely fantastic, highly recommend!",
    "Waste of money, do not buy"
]
labels = ["positive", "negative", "neutral", "positive", "negative"]

# Train
vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(texts)
model = MultinomialNB()
model.fit(X, labels)

# Save
with open("sentiment_model.pkl", "wb") as f:
    pickle.dump((vectorizer, model), f)

print("Model trained and saved!")
```

Run it:
```bash
python train_model.py
```

### Step 2: Create Uncached Prediction Function

```python
# predict_uncached.py
import pickle
import time

# Load model
with open("sentiment_model.pkl", "rb") as f:
    vectorizer, model = pickle.load(f)

def predict_sentiment(text: str) -> dict:
    """Predict sentiment without caching."""
    start = time.time()

    # Simulate slow model (add artificial delay)
    time.sleep(0.1)  # Real models might take 10-500ms

    # Actual prediction
    X = vectorizer.transform([text])
    prediction = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]

    duration = (time.time() - start) * 1000
    print(f"Prediction took {duration:.2f}ms")

    return {
        "sentiment": prediction,
        "confidence": max(probabilities),
        "duration_ms": duration
    }

# Test it
if __name__ == "__main__":
    result = predict_sentiment("This is amazing!")
    print(result)
    # Output: {'sentiment': 'positive', 'confidence': 0.87, 'duration_ms': 102.45}

    # Call again with same text
    result = predict_sentiment("This is amazing!")
    print(result)
    # Output: {'sentiment': 'positive', 'confidence': 0.87, 'duration_ms': 101.89}
    # Still takes ~100ms - no caching!
```

### Step 3: Add ModelCache

Now let's add caching:

```python
# predict_cached.py
import pickle
import time
from modelcache import Cache
from modelcache.backends import RedisBackend

# Load model
with open("sentiment_model.pkl", "rb") as f:
    vectorizer, model = pickle.load(f)

# Initialize cache
cache = Cache(
    backend=RedisBackend(
        host="localhost",
        port=6379,
        db=0
    ),
    ttl_seconds=3600,  # Cache for 1 hour
    namespace="sentiment"  # Prefix for all keys
)

@cache.cached(key_func=lambda text: f"text:{hash(text)}")
def predict_sentiment(text: str) -> dict:
    """Predict sentiment WITH caching."""
    start = time.time()

    # Simulate slow model
    time.sleep(0.1)

    # Actual prediction
    X = vectorizer.transform([text])
    prediction = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]

    duration = (time.time() - start) * 1000
    print(f"[CACHE MISS] Prediction took {duration:.2f}ms")

    return {
        "sentiment": prediction,
        "confidence": max(probabilities),
        "duration_ms": duration
    }

# Test it
if __name__ == "__main__":
    print("=== First call (cache miss) ===")
    result = predict_sentiment("This is amazing!")
    print(result)
    # Output: [CACHE MISS] Prediction took 102.45ms

    print("\n=== Second call (cache hit) ===")
    result = predict_sentiment("This is amazing!")
    print(result)
    # Output: (no CACHE MISS message, returned from cache)
    # Duration: ~2ms - 50x faster!

    print("\n=== Cache metrics ===")
    metrics = cache.get_metrics()
    print(f"Hit rate: {metrics.hit_rate:.2%}")
    print(f"Total requests: {metrics.total_requests}")
    print(f"Cache hits: {metrics.hits}")
    print(f"Cache misses: {metrics.misses}")
```

Run it:
```bash
python predict_cached.py
```

Output:
```
=== First call (cache miss) ===
[CACHE MISS] Prediction took 102.45ms
{'sentiment': 'positive', 'confidence': 0.87, 'duration_ms': 102.45}

=== Second call (cache hit) ===
{'sentiment': 'positive', 'confidence': 0.87, 'duration_ms': 102.45}

=== Cache metrics ===
Hit rate: 50.00%
Total requests: 2
Cache hits: 1
Cache misses: 1
```

Notice the second call didn't print `[CACHE MISS]` and was nearly instant!

---

## Understanding What Just Happened

Let's break down the caching flow:

### First Call (Cache Miss)

```python
predict_sentiment("This is amazing!")
```

1. **Generate cache key**: `hash("This is amazing!")` → `"text:1234567890"`
2. **Check cache**: Redis doesn't have key `"sentiment:text:1234567890"`
3. **Cache miss**: Execute the decorated function
4. **Run inference**: Model predicts "positive" (takes 102ms)
5. **Store in cache**: Save result to Redis with TTL=3600s
6. **Return result**: `{"sentiment": "positive", ...}`

### Second Call (Cache Hit)

```python
predict_sentiment("This is amazing!")
```

1. **Generate cache key**: `hash("This is amazing!")` → `"text:1234567890"` (same!)
2. **Check cache**: Redis has key `"sentiment:text:1234567890"`
3. **Cache hit**: Return cached value immediately (~2ms)
4. **Skip inference**: Model never executed
5. **Return result**: Same as before, but 50x faster

---

## Configuring Cache Behavior

### Setting Different TTLs

```python
# Short TTL for frequently changing data
cache_short = Cache(
    backend=RedisBackend(...),
    ttl_seconds=300  # 5 minutes
)

# Long TTL for stable data
cache_long = Cache(
    backend=RedisBackend(...),
    ttl_seconds=86400  # 24 hours
)

# Dynamic TTL based on result
@cache.cached(
    ttl_func=lambda result: 3600 if result["confidence"] > 0.9 else 600
)
def predict(text):
    # High-confidence predictions cached longer
    pass
```

### Using Different Cache Key Strategies

```python
# Strategy 1: Hash entire input
@cache.cached(key_func=lambda text: f"hash:{hash(text)}")

# Strategy 2: Use first N characters (for similar texts)
@cache.cached(key_func=lambda text: f"prefix:{text[:20]}")

# Strategy 3: Combine multiple fields
@cache.cached(
    key_func=lambda user_id, item_id, context:
        f"{user_id}:{item_id}:{context}"
)
def recommend(user_id, item_id, context):
    pass

# Strategy 4: Custom key with normalization
def normalize_text(text):
    return text.lower().strip()

@cache.cached(key_func=lambda text: f"norm:{hash(normalize_text(text))}")
def predict(text):
    pass
```

### Limiting Cache Size

```python
cache = Cache(
    backend=RedisBackend(...),
    max_size_mb=1024,  # Limit to 1GB
    eviction_policy="lru"  # Least Recently Used
)
```

When cache reaches 1GB, least recently used items are automatically evicted.

---

## Monitoring Cache Performance

### Real-time Metrics

```python
# Get current metrics
metrics = cache.get_metrics()

print(f"Hit rate: {metrics.hit_rate:.2%}")
print(f"Miss rate: {metrics.miss_rate:.2%}")
print(f"Total requests: {metrics.total_requests}")
print(f"Avg latency: {metrics.avg_latency_ms:.2f}ms")
print(f"Cache size: {metrics.size_mb:.2f}MB")
print(f"Items cached: {metrics.item_count}")
```

### Metrics Over Time

```python
import time

# Monitor for 60 seconds
for _ in range(12):
    metrics = cache.get_metrics(window="5s")  # Last 5 seconds
    print(f"Hit rate: {metrics.hit_rate:.1%} | "
          f"RPS: {metrics.requests_per_second:.0f} | "
          f"Latency: {metrics.avg_latency_ms:.2f}ms")
    time.sleep(5)
```

### Setting Up Alerts

```python
def check_cache_health():
    metrics = cache.get_metrics()

    if metrics.hit_rate < 0.50:
        alert("Low cache hit rate", metrics.hit_rate)

    if metrics.avg_latency_ms > 10:
        alert("High cache latency", metrics.avg_latency_ms)

    if metrics.error_rate > 0.01:
        alert("Cache errors detected", metrics.error_rate)

# Run periodically
import schedule
schedule.every(1).minute.do(check_cache_health)
```

---

## Debugging Cache Issues

### Issue 1: Low Hit Rate

**Symptom**: Hit rate < 30%

**Causes**:
- Cache keys not deterministic (randomness in key generation)
- TTL too short (items expire before being reused)
- Traffic too diverse (no repeated queries)

**Solution**:
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

cache.enable_debug_logging()

# Inspect keys being generated
@cache.cached(key_func=lambda x: print(f"Key: {hash(x)}") or f"{hash(x)}")
def predict(text):
    pass
```

### Issue 2: High Latency on Cache Hits

**Symptom**: Cache hits taking > 10ms

**Causes**:
- Large cached objects (serialization overhead)
- Network latency to Redis
- Redis under heavy load

**Solution**:
```python
# Use compression for large objects
cache = Cache(
    backend=RedisBackend(...),
    compress=True,  # Compress values > 1KB
    compression_threshold_bytes=1024
)

# Or cache only essential data
@cache.cached(key_func=lambda x: hash(x))
def predict(text):
    result = expensive_model(text)

    # Cache only essential fields
    return {
        "class": result["class"],
        "score": result["score"]
        # Don't cache large fields like "embeddings"
    }
```

### Issue 3: Stale Cache Data

**Symptom**: Cached predictions are outdated after model update

**Solution**:
```python
# Invalidate cache when model changes
def deploy_new_model(model_path):
    load_model(model_path)

    # Clear all cached predictions
    cache.flush()

    print("Cache cleared, all predictions will be recomputed")

# Or use versioned keys
MODEL_VERSION = "v2"

@cache.cached(key_func=lambda x: f"{MODEL_VERSION}:{hash(x)}")
def predict(text):
    pass

# When updating model, change MODEL_VERSION to "v3"
# Old v2 predictions remain cached but unused
```

---

## Best Practices

### ✅ DO

- **Use Redis for production** (reliable, persistent, distributed)
- **Set appropriate TTLs** based on data freshness requirements
- **Monitor hit rates** and adjust cache key strategy if low
- **Use namespaces** to separate different model caches
- **Implement fallback** logic if cache fails

```python
cache = Cache(
    backend=RedisBackend(...),
    fallback_on_error=True  # Bypass cache if Redis is down
)
```

### ❌ DON'T

- **Don't cache non-deterministic models** (e.g., models with dropout, sampling)
- **Don't use unbounded cache keys** (can lead to memory explosion)
- **Don't cache PII** (personally identifiable information) without encryption
- **Don't ignore cache errors** (log and alert on failures)

---

## Next Steps

Now that you understand ModelCache basics, continue to:

**[Part 2: Integration Patterns](./02-integration-patterns.md)**
Learn how to integrate ModelCache with popular ML frameworks:
- TensorFlow Serving
- PyTorch
- FastAPI
- SageMaker

**[Part 3: Cache Key Design](./03-cache-key-design.md)**
Design effective cache keys for complex models and use cases.

**[Configuration Reference](./configuration-reference.md)**
Complete configuration options and advanced settings.

---

## Summary

In this tutorial, you learned:

- ✅ How to install and configure ModelCache
- ✅ Core concepts: cache keys, TTL, eviction, backends
- ✅ How to add caching to a model with the `@cache.cached` decorator
- ✅ How to monitor cache performance
- ✅ How to debug common cache issues

**Key takeaway**: ModelCache can dramatically reduce latency and costs for ML inference workloads with minimal code changes.

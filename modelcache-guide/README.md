# ModelCache Integration Guide

**Accelerate ML Inference with Intelligent Caching**

---

## Overview

ModelCache is a distributed caching layer designed specifically for machine learning inference workloads. By caching model predictions, you can:

- **Reduce latency** by 10-100x for repeated queries
- **Lower infrastructure costs** by reducing compute requirements
- **Improve reliability** with built-in fallback mechanisms
- **Scale efficiently** during traffic spikes

This guide walks you through integrating ModelCache into your ML serving infrastructure, from basic setup to advanced caching strategies.

---

## What's Inside

### 📖 Tutorial Series

**[Part 1: Getting Started](./01-getting-started.md)**
Install ModelCache, configure your first cache, and understand core concepts.

**[Part 2: Integration Patterns](./02-integration-patterns.md)**
Learn how to integrate ModelCache with popular ML frameworks and serving platforms.

**[Part 3: Cache Key Design](./03-cache-key-design.md)**
Design effective cache keys for different model types and use cases.

**[Part 4: Cache Invalidation Strategies](./04-invalidation-strategies.md)**
Implement smart invalidation policies to keep predictions fresh.

**[Part 5: Production Deployment](./05-production-deployment.md)**
Deploy ModelCache in production with high availability and monitoring.

### 📚 Reference Documentation

**[Configuration Reference](./configuration-reference.md)**
Complete configuration options for ModelCache.

**[API Reference](./api-reference.md)**
Programmatic API for cache operations.

**[Performance Tuning](./performance-tuning.md)**
Optimize cache performance for your workload.

---

## Quick Example

```python
from modelcache import Cache
from modelcache.backends import RedisBackend

# Initialize cache
cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,  # 1 hour
    max_size_mb=1024   # 1 GB
)

# Wrap your model
@cache.cached(key_func=lambda x: x["user_id"] + x["item_id"])
def predict_recommendation(user_id, item_id):
    # Your expensive model inference
    return model.predict(user_id, item_id)

# First call: Cache miss, runs inference
result = predict_recommendation("user_123", "item_456")
# Duration: 250ms

# Second call: Cache hit, returns instantly
result = predict_recommendation("user_123", "item_456")
# Duration: 2ms (125x faster!)
```

---

## Who Should Use This Guide

This guide is for:

- **ML Engineers** deploying models to production
- **Platform Engineers** building ML infrastructure
- **Data Scientists** optimizing model serving costs
- **DevOps Engineers** managing ML systems at scale

**Prerequisites**:
- Familiarity with Python and ML concepts
- Experience deploying ML models (any framework)
- Basic understanding of caching concepts

---

## Architecture Overview

ModelCache sits between your application and ML model:

```
┌─────────────┐
│ Application │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   ModelCache    │ ◄─── Cache Hit: Return immediately
└────────┬────────┘
         │ Cache Miss
         ▼
┌─────────────────┐
│   ML Model      │
└─────────────────┘
```

**Cache Hit Flow** (2-5ms):
1. Request arrives
2. ModelCache checks for cached result
3. Returns cached prediction

**Cache Miss Flow** (model inference time + 2-5ms):
1. Request arrives
2. ModelCache checks for cached result (miss)
3. Forwards request to model
4. Stores result in cache
5. Returns prediction

---

## Supported Backends

ModelCache supports multiple backend storage systems:

| Backend | Latency | Throughput | Use Case |
|---------|---------|------------|----------|
| **Redis** | 1-2ms | 100k+ ops/sec | General purpose, production |
| **Memcached** | 1-2ms | 200k+ ops/sec | High-throughput, simple caching |
| **PostgreSQL** | 5-10ms | 10k ops/sec | Persistent cache, complex queries |
| **DynamoDB** | 10-20ms | Auto-scales | Serverless, managed |
| **In-Memory** | < 1ms | 1M+ ops/sec | Development, single-instance |

Choose based on your latency, persistence, and scalability requirements.

---

## Key Features

### 🔑 Flexible Key Generation
Define custom cache keys based on your model inputs:
```python
# Simple key from one field
@cache.cached(key="user_id")

# Composite key from multiple fields
@cache.cached(key=["user_id", "timestamp", "context"])

# Custom key function
@cache.cached(key_func=lambda x: f"{x['user']}:{hash(x['features'])}")
```

### ⏰ Smart TTL Management
Set appropriate cache lifetimes:
```python
# Fixed TTL
cache = Cache(ttl_seconds=3600)

# Dynamic TTL based on prediction confidence
@cache.cached(ttl_func=lambda result: 3600 if result["confidence"] > 0.9 else 300)
```

### 🔄 Automatic Invalidation
Invalidate stale cache entries:
```python
# Invalidate by pattern
cache.invalidate(pattern="user:123:*")

# Invalidate on model update
model.on_update(lambda: cache.flush())
```

### 📊 Built-in Metrics
Monitor cache performance:
```python
metrics = cache.get_metrics()
print(f"Hit rate: {metrics.hit_rate:.2%}")
print(f"Avg latency: {metrics.avg_latency_ms:.2f}ms")
```

### 🛡️ Failure Resilience
Graceful degradation when cache is unavailable:
```python
cache = Cache(
    backend=RedisBackend(...),
    fallback_on_error=True  # Bypass cache if backend fails
)
```

---

## Real-World Results

Organizations using ModelCache report:

- **90% cache hit rates** for recommendation systems
- **50-70% reduction** in inference costs
- **10x latency improvement** for p95 response times
- **Zero downtime** during model version rollouts

---

## Getting Started

Ready to integrate ModelCache? Start with [Part 1: Getting Started](./01-getting-started.md).

Or jump to:
- [Integration with TensorFlow Serving](./02-integration-patterns.md#tensorflow-serving)
- [Integration with PyTorch](./02-integration-patterns.md#pytorch)
- [Integration with FastAPI](./02-integration-patterns.md#fastapi)
- [Integration with SageMaker](./02-integration-patterns.md#sagemaker)

---

## Support

- **Documentation**: You're reading it!
- **Issues**: [github.com/modelcache/modelcache/issues](https://github.com/modelcache/modelcache/issues)
- **Discussions**: [github.com/modelcache/modelcache/discussions](https://github.com/modelcache/modelcache/discussions)
- **Commercial Support**: support@modelcache.io

# Configuration Reference

Complete reference for ModelCache configuration options.

---

## Cache Initialization

### Basic Configuration

```python
from modelcache import Cache
from modelcache.backends import RedisBackend

cache = Cache(
    backend=RedisBackend(host="localhost", port=6379),
    ttl_seconds=3600,
    namespace="myapp"
)
```

### All Configuration Options

```python
cache = Cache(
    # Backend configuration (required)
    backend=RedisBackend(...),          # Storage backend

    # TTL configuration
    ttl_seconds=3600,                    # Default TTL (None = no expiration)
    ttl_jitter_seconds=60,               # Add random jitter to TTL (prevents thundering herd)

    # Size limits
    max_size_mb=1024,                    # Max cache size in MB (None = unlimited)
    max_items=1000000,                   # Max number of items (None = unlimited)

    # Eviction policy
    eviction_policy="lru",               # "lru", "lfu", "fifo", or "ttl"

    # Namespacing
    namespace="myapp",                   # Prefix for all keys (useful for multi-tenant)

    # Serialization
    serializer="pickle",                 # "pickle", "json", "msgpack", "protobuf"
    compression="gzip",                  # None, "gzip", "lz4", "zstd"
    compression_threshold_bytes=1024,    # Only compress values larger than this

    # Failure handling
    fallback_on_error=True,              # Bypass cache on backend errors
    error_callback=lambda e: logger.error(e),  # Called on cache errors

    # Performance
    connection_pool_size=10,             # Backend connection pool size
    timeout_ms=100,                      # Operation timeout

    # Monitoring
    enable_metrics=True,                 # Track hit rate, latency, etc.
    metrics_window_seconds=60,           # Metrics aggregation window

    # Debugging
    debug=False                          # Enable debug logging
)
```

---

## Backend Configuration

### Redis Backend

```python
from modelcache.backends import RedisBackend

backend = RedisBackend(
    host="localhost",                    # Redis host
    port=6379,                           # Redis port
    db=0,                                # Redis database (0-15)
    password=None,                       # Redis password (if auth enabled)

    # Connection pooling
    max_connections=50,                  # Connection pool size
    socket_connect_timeout=5,            # Connection timeout (seconds)
    socket_timeout=5,                    # Socket operation timeout

    # Clustering
    cluster_mode=False,                  # Use Redis Cluster
    cluster_nodes=[                      # Cluster node list (if cluster_mode=True)
        {"host": "node1", "port": 6379},
        {"host": "node2", "port": 6379}
    ],

    # SSL/TLS
    ssl=False,                           # Use SSL
    ssl_cert_reqs="required",           # "required", "optional", "none"
    ssl_ca_certs="/path/to/ca.pem",     # CA certificate path

    # Sentinel (high availability)
    sentinel_mode=False,                 # Use Redis Sentinel
    sentinel_hosts=[                     # Sentinel instances
        ("sentinel1", 26379),
        ("sentinel2", 26379)
    ],
    sentinel_master="mymaster",          # Master name

    # Advanced
    decode_responses=False,              # Decode bytes to strings
    health_check_interval=30             # Connection health check (seconds)
)
```

### Memcached Backend

```python
from modelcache.backends import MemcachedBackend

backend = MemcachedBackend(
    servers=[                            # Memcached servers
        "localhost:11211",
        "cache2:11211"
    ],

    # Connection
    connect_timeout=5,                   # Connection timeout (seconds)
    timeout=1,                           # Operation timeout (seconds)

    # Performance
    no_delay=True,                       # Disable Nagle's algorithm
    max_pool_size=10,                    # Connection pool size

    # Hashing
    hash_algorithm="md5",                # Key hashing: "md5", "fnv1a", "crc32"

    # Failover
    retry_on_timeout=3,                  # Retry attempts on timeout
    dead_retry=30                        # Retry dead servers after N seconds
)
```

### DynamoDB Backend

```python
from modelcache.backends import DynamoDBBackend

backend = DynamoDBBackend(
    table_name="model_cache",            # DynamoDB table name
    region_name="us-east-1",             # AWS region

    # Authentication
    aws_access_key_id=None,              # AWS credentials (None = use IAM role)
    aws_secret_access_key=None,

    # Performance
    read_capacity_units=5,               # Provisioned RCU (if not on-demand)
    write_capacity_units=5,              # Provisioned WCU
    billing_mode="PAY_PER_REQUEST",      # "PAY_PER_REQUEST" or "PROVISIONED"

    # TTL
    ttl_attribute="ttl",                 # DynamoDB TTL attribute name
    enable_ttl=True,                     # Enable automatic TTL deletion

    # Consistency
    consistent_read=False                # Use strongly consistent reads
)
```

### PostgreSQL Backend

```python
from modelcache.backends import PostgreSQLBackend

backend = PostgreSQLBackend(
    host="localhost",
    port=5432,
    database="cache_db",
    user="cache_user",
    password="password",

    # Table configuration
    table_name="model_cache",            # Cache table name
    create_table_if_not_exists=True,     # Auto-create table

    # Connection pooling
    min_pool_size=5,                     # Min connections
    max_pool_size=20,                    # Max connections
    pool_timeout=30,                     # Get connection timeout

    # SSL
    sslmode="prefer",                    # "disable", "allow", "prefer", "require"
    sslcert="/path/to/cert.pem",        # Client certificate

    # Performance
    use_prepared_statements=True,        # Use prepared statements
    statement_cache_size=100             # Prepared statement cache size
)
```

### In-Memory Backend

```python
from modelcache.backends import InMemoryBackend

backend = InMemoryBackend(
    max_size_mb=512,                     # Max memory usage
    eviction_policy="lru",               # Eviction when full

    # Persistence (optional)
    persist_to_disk=False,               # Save to disk periodically
    persist_path="/tmp/cache.db",        # Disk storage path
    persist_interval_seconds=300         # Persist every 5 minutes
)
```

---

## Decorator Options

### `@cache.cached()`

```python
@cache.cached(
    # Key generation
    key=None,                            # Simple key (string or list of param names)
    key_func=None,                       # Custom key function

    # TTL override
    ttl_seconds=None,                    # Override default TTL
    ttl_func=None,                       # Dynamic TTL function

    # Serialization override
    serializer=None,                     # Override cache serializer
    serialize_func=None,                 # Custom serialization function
    deserialize_func=None,               # Custom deserialization function

    # Conditional caching
    condition=None,                      # Cache only if function returns True
    cache_none=False,                    # Cache None results

    # Exceptions
    cache_exceptions=False,              # Cache exception results
    exception_ttl_seconds=60,            # TTL for cached exceptions

    # Performance
    async_set=False,                     # Set cache asynchronously (don't wait)
    prefetch=False,                      # Prefetch from cache before function execution

    # Monitoring
    on_hit=None,                         # Callback on cache hit: on_hit(key, value)
    on_miss=None                         # Callback on cache miss: on_miss(key)
)
def my_function(arg1, arg2):
    pass
```

### Key Generation Examples

**Simple key from parameter name**:
```python
@cache.cached(key="user_id")
def get_user_recommendations(user_id: str, context: str):
    # Key: "user_id:12345"
    pass
```

**Composite key from multiple parameters**:
```python
@cache.cached(key=["user_id", "context"])
def get_user_recommendations(user_id: str, context: str):
    # Key: "user_id:12345:context:home"
    pass
```

**Custom key function**:
```python
@cache.cached(key_func=lambda user_id, items: f"{user_id}:{hash(tuple(items))}")
def recommend(user_id: str, items: list):
    pass
```

**Include instance state in key (for class methods)**:
```python
class Model:
    def __init__(self, version):
        self.version = version

    @cache.cached(key_func=lambda self, input: f"v{self.version}:{hash(input)}")
    def predict(self, input):
        pass
```

### TTL Examples

**Fixed TTL override**:
```python
@cache.cached(ttl_seconds=7200)  # 2 hours instead of default
def expensive_operation(x):
    pass
```

**Dynamic TTL based on result**:
```python
@cache.cached(
    ttl_func=lambda result:
        3600 if result["confidence"] > 0.9 else 600
)
def predict(input):
    # High-confidence predictions cached longer
    pass
```

**Dynamic TTL based on input**:
```python
@cache.cached(
    ttl_func=lambda user_tier: {
        "premium": 7200,
        "standard": 3600,
        "free": 600
    }[user_tier]
)
def get_recommendations(user_tier: str):
    pass
```

### Conditional Caching

**Cache only successful results**:
```python
@cache.cached(
    condition=lambda result: result["status"] == "success"
)
def api_call(url):
    # Only cache successful API responses
    pass
```

**Don't cache None**:
```python
@cache.cached(cache_none=False)
def lookup(key):
    # If function returns None, don't cache it
    return database.get(key)  # May return None
```

### Serialization Customization

**Custom serialization for complex types**:
```python
import numpy as np

@cache.cached(
    serialize_func=lambda arr: arr.tobytes(),
    deserialize_func=lambda b: np.frombuffer(b)
)
def process_array(arr: np.ndarray):
    pass
```

**Use JSON instead of pickle**:
```python
@cache.cached(serializer="json")
def get_config(env: str):
    return {"env": env, "settings": {...}}
```

---

## Cache Operations

### Manual Cache Operations

```python
# Set value
cache.set(key="user:123", value={"name": "Alice"}, ttl_seconds=3600)

# Get value
value = cache.get(key="user:123")
# Returns None if not found

# Get with default
value = cache.get(key="user:123", default={})

# Delete key
cache.delete(key="user:123")

# Check existence
exists = cache.exists(key="user:123")

# Get TTL remaining
ttl = cache.ttl(key="user:123")  # Returns seconds, or None if no TTL

# Set new TTL
cache.expire(key="user:123", ttl_seconds=7200)
```

### Batch Operations

```python
# Get multiple keys
values = cache.get_many(keys=["user:1", "user:2", "user:3"])
# Returns dict: {"user:1": {...}, "user:2": {...}, ...}

# Set multiple keys
cache.set_many({
    "user:1": {"name": "Alice"},
    "user:2": {"name": "Bob"}
}, ttl_seconds=3600)

# Delete multiple keys
cache.delete_many(keys=["user:1", "user:2"])
```

### Pattern Matching

```python
# Invalidate by pattern
cache.invalidate(pattern="user:*")           # All user keys
cache.invalidate(pattern="rec:123:*")        # User 123's recommendations
cache.invalidate(pattern="*:v1:*")           # All v1 predictions

# Get keys matching pattern
keys = cache.keys(pattern="user:*")

# Count keys matching pattern
count = cache.count(pattern="rec:*")
```

### Cache Clearing

```python
# Clear entire cache
cache.flush()

# Clear only this namespace
cache.flush(namespace="myapp")

# Clear all namespaces
cache.flush(all_namespaces=True)
```

---

## Metrics and Monitoring

### Get Metrics

```python
# Get current metrics
metrics = cache.get_metrics()

# Access metric values
print(f"Hit rate: {metrics.hit_rate:.2%}")
print(f"Miss rate: {metrics.miss_rate:.2%}")
print(f"Total requests: {metrics.total_requests}")
print(f"Hits: {metrics.hits}")
print(f"Misses: {metrics.misses}")
print(f"Errors: {metrics.errors}")
print(f"Avg latency: {metrics.avg_latency_ms:.2f}ms")
print(f"P50 latency: {metrics.p50_latency_ms:.2f}ms")
print(f"P95 latency: {metrics.p95_latency_ms:.2f}ms")
print(f"P99 latency: {metrics.p99_latency_ms:.2f}ms")
print(f"Cache size: {metrics.size_mb:.2f}MB")
print(f"Item count: {metrics.item_count}")
print(f"Evictions: {metrics.evictions}")
```

### Time-Windowed Metrics

```python
# Get metrics for specific time window
metrics = cache.get_metrics(window="5m")   # Last 5 minutes
metrics = cache.get_metrics(window="1h")   # Last 1 hour
metrics = cache.get_metrics(window="24h")  # Last 24 hours
```

### Reset Metrics

```python
cache.reset_metrics()
```

### Export Metrics

```python
# Export to Prometheus format
prometheus_metrics = cache.export_metrics(format="prometheus")

# Export to JSON
json_metrics = cache.export_metrics(format="json")

# Export to StatsD
cache.export_metrics(format="statsd", host="localhost", port=8125)
```

---

## Advanced Configuration

### Connection Pooling

```python
from modelcache import Cache
from modelcache.backends import RedisBackend

backend = RedisBackend(
    host="localhost",
    max_connections=100,                 # Connection pool size
    socket_connect_timeout=5,
    socket_timeout=5,
    health_check_interval=30
)

cache = Cache(backend=backend)
```

### Compression

```python
cache = Cache(
    backend=RedisBackend(...),
    compression="zstd",                  # Best compression ratio
    compression_threshold_bytes=10240    # Compress values > 10KB
)

# Compression comparison:
# - None: Fastest, largest size
# - lz4: Very fast, good compression
# - gzip: Medium speed, good compression
# - zstd: Slower, best compression
```

### Custom Serialization

```python
import msgpack

cache = Cache(
    backend=RedisBackend(...),
    serializer="msgpack",                # Faster than pickle, smaller than JSON
)

# Or use custom serializer
class CustomSerializer:
    def serialize(self, obj):
        return msgpack.packb(obj, use_bin_type=True)

    def deserialize(self, data):
        return msgpack.unpackb(data, raw=False)

cache = Cache(
    backend=RedisBackend(...),
    serializer=CustomSerializer()
)
```

### Multi-tier Caching

```python
from modelcache import MultiTierCache
from modelcache.backends import InMemoryBackend, RedisBackend

# L1: In-memory (fast, small)
# L2: Redis (persistent, large)
cache = MultiTierCache(
    tiers=[
        InMemoryBackend(max_size_mb=128),  # L1: 128MB in-memory
        RedisBackend(host="localhost")     # L2: Redis
    ],
    ttl_seconds=3600
)

# Lookups check L1 first, then L2
# Writes go to both tiers
```

### Sharding

```python
from modelcache import ShardedCache
from modelcache.backends import RedisBackend

# Distribute cache across multiple Redis instances
cache = ShardedCache(
    shards=[
        RedisBackend(host="redis1", port=6379),
        RedisBackend(host="redis2", port=6379),
        RedisBackend(host="redis3", port=6379)
    ],
    hash_func=lambda key: hash(key) % 3  # Modulo sharding
)
```

---

## Environment Variables

ModelCache supports configuration via environment variables:

```bash
# Backend
export MODELCACHE_BACKEND=redis
export MODELCACHE_REDIS_HOST=localhost
export MODELCACHE_REDIS_PORT=6379
export MODELCACHE_REDIS_DB=0
export MODELCACHE_REDIS_PASSWORD=secret

# Cache behavior
export MODELCACHE_TTL_SECONDS=3600
export MODELCACHE_MAX_SIZE_MB=1024
export MODELCACHE_NAMESPACE=myapp

# Performance
export MODELCACHE_COMPRESSION=zstd
export MODELCACHE_SERIALIZER=msgpack

# Monitoring
export MODELCACHE_ENABLE_METRICS=true
export MODELCACHE_DEBUG=false
```

Load from environment:
```python
cache = Cache.from_env()
```

---

## Configuration File

Define configuration in YAML:

```yaml
# cache_config.yaml
backend:
  type: redis
  host: localhost
  port: 6379
  db: 0
  max_connections: 50

cache:
  ttl_seconds: 3600
  max_size_mb: 1024
  namespace: myapp
  eviction_policy: lru

serialization:
  serializer: msgpack
  compression: zstd
  compression_threshold_bytes: 1024

monitoring:
  enable_metrics: true
  metrics_window_seconds: 60

performance:
  fallback_on_error: true
  connection_pool_size: 10
```

Load configuration:
```python
cache = Cache.from_config("cache_config.yaml")
```

---

## Best Practices

### ✅ Recommendations

1. **Use Redis for production** - Most battle-tested, feature-rich backend
2. **Set appropriate TTLs** - Balance freshness vs. cache hit rate
3. **Use compression** for large values (> 10KB)
4. **Enable metrics** in production for monitoring
5. **Use namespaces** to isolate different models/environments
6. **Set `fallback_on_error=True`** to gracefully handle cache failures
7. **Use connection pooling** for high-throughput applications

### ❌ Anti-patterns

1. **Don't cache unbounded data** - Set `max_size_mb` to prevent OOM
2. **Don't use default serializer for production** - Use msgpack or protobuf
3. **Don't ignore cache errors** - Set `error_callback` to log issues
4. **Don't cache without TTL** - Set explicit TTLs to prevent stale data
5. **Don't use in-memory backend in production** - Not distributed or persistent

---

## Troubleshooting

### High Memory Usage

```python
# Check cache size
metrics = cache.get_metrics()
print(f"Cache size: {metrics.size_mb:.2f}MB")

# Reduce max size
cache.update_config(max_size_mb=512)

# Enable compression
cache.update_config(compression="zstd")
```

### Low Hit Rate

```python
# Check hit rate
metrics = cache.get_metrics()
print(f"Hit rate: {metrics.hit_rate:.2%}")

# Possible causes:
# 1. TTL too short
cache.update_config(ttl_seconds=7200)

# 2. Cache keys not deterministic
# Fix: Ensure key_func generates same key for same input

# 3. Traffic too diverse (no repeated queries)
# Solution: May not be suitable for caching
```

### Connection Errors

```python
# Enable fallback mode
cache = Cache(
    backend=RedisBackend(...),
    fallback_on_error=True,  # Bypass cache on errors
    error_callback=lambda e: logger.error(f"Cache error: {e}")
)
```

---

## See Also

- [Getting Started Guide](./01-getting-started.md)
- [Integration Patterns](./02-integration-patterns.md)
- [Performance Tuning](./performance-tuning.md)

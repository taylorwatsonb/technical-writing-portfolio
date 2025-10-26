# 1.1 System Architecture

Understanding the components and design patterns of production ML systems.

---

## Overview

A production ML system is more than just a trained model. It's a complex distributed system with many interconnected components:

- **Data pipelines**: Collect, process, and serve data
- **Training infrastructure**: Retrain models periodically
- **Serving infrastructure**: Handle inference requests
- **Monitoring systems**: Track performance and health
- **Feature stores**: Manage and serve features consistently
- **Model registry**: Version and deploy models

This chapter explains how these components fit together and interact.

---

## Core Components

### 1. Prediction Service

The **prediction service** is the heart of your ML system. It:
- Receives inference requests from clients
- Loads models from the model registry
- Fetches features from the feature store
- Runs inference and returns predictions
- Logs predictions for monitoring

**Key requirements**:
- **Low latency**: p99 < 100ms for real-time applications
- **High availability**: 99.9%+ uptime
- **Scalability**: Handle traffic spikes
- **Version management**: Support multiple model versions

**Example architecture**:
```
┌─────────────────────────────────────────────┐
│         Prediction Service (FastAPI)        │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Request Handler                    │  │
│  │   - Validate input                   │  │
│  │   - Extract features                 │  │
│  │   - Call model                       │  │
│  │   - Return prediction                │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ Model Loader │    │  Feature Store   │  │
│  │              │    │  Client          │  │
│  └──────────────┘    └──────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Metrics & Logging                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Implementation example**:
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mlflow.pyfunc

app = FastAPI()

# Load model from registry
model = mlflow.pyfunc.load_model("models:/fraud-detector/production")

class PredictionRequest(BaseModel):
    transaction_amount: float
    merchant_id: str
    user_id: str

@app.post("/predict")
async def predict(request: PredictionRequest):
    try:
        # Extract features
        features = {
            "amount": request.transaction_amount,
            "merchant_category": get_merchant_category(request.merchant_id),
            "user_age_days": get_user_age(request.user_id),
            # ... more features
        }

        # Run inference
        prediction = model.predict([features])[0]

        # Log for monitoring
        log_prediction(request, prediction)

        return {
            "fraud_score": float(prediction),
            "timestamp": datetime.utcnow(),
            "model_version": model.metadata.version
        }

    except Exception as e:
        log_error(e)
        raise HTTPException(status_code=500, detail=str(e))
```

---

### 2. Feature Store

The **feature store** centralizes feature computation and serving:
- Ensures training/serving consistency (prevents training-serving skew)
- Caches computed features for low-latency access
- Manages feature versioning and lineage
- Enables feature reuse across models

**Architecture**:
```
┌────────────────────────────────────────────┐
│           Feature Store                    │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Online Store (Redis/DynamoDB)      │  │
│  │  - Low latency (< 10ms)             │  │
│  │  - Precomputed features             │  │
│  │  - Real-time features               │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Offline Store (S3/BigQuery)        │  │
│  │  - Historical features              │  │
│  │  - Training data                    │  │
│  │  - Batch features                   │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Feature Registry                   │  │
│  │  - Feature definitions              │  │
│  │  - Schemas & metadata               │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Why use a feature store?**

❌ **Without feature store**:
```python
# Training (batch)
def compute_features_batch(user_id):
    # Complex SQL query
    return features

# Serving (real-time)
def compute_features_realtime(user_id):
    # Different Python code, might have bugs!
    return features

# Risk: Training-serving skew if implementations differ
```

✅ **With feature store**:
```python
# Define once, use everywhere
@feature_store.register
def user_purchase_count_7d(user_id):
    return db.query("SELECT COUNT(*) FROM purchases WHERE ...")

# Training
features = feature_store.get_offline_features(
    feature_refs=["user_purchase_count_7d"],
    entity_rows=training_users
)

# Serving (same definition!)
features = feature_store.get_online_features(
    feature_refs=["user_purchase_count_7d"],
    entity_keys={"user_id": "123"}
)
```

**Popular feature stores**:
- Feast (open source)
- Tecton (commercial)
- AWS SageMaker Feature Store
- Databricks Feature Store

---

### 3. Model Registry

The **model registry** is a centralized repository for ML models:
- Store trained model artifacts
- Version models (v1, v2, v3, etc.)
- Track metadata (metrics, parameters, training data)
- Manage deployment lifecycle (staging, production, archived)

**Key capabilities**:
- **Versioning**: Track model lineage
- **Metadata**: Store training metrics, dataset info, hyperparameters
- **Access control**: Who can deploy which models
- **Rollback**: Easily revert to previous versions

**Example workflow**:
```python
import mlflow

# During training
with mlflow.start_run():
    # Train model
    model = train_model(X_train, y_train)

    # Log metrics
    mlflow.log_metric("accuracy", 0.94)
    mlflow.log_metric("f1_score", 0.92)

    # Log model
    mlflow.sklearn.log_model(model, "fraud-detector")

    # Register model
    mlflow.register_model(
        model_uri=f"runs:/{mlflow.active_run().info.run_id}/fraud-detector",
        name="fraud-detector"
    )

# Promote to production
client = mlflow.MlflowClient()
client.transition_model_version_stage(
    name="fraud-detector",
    version=3,
    stage="Production"
)

# In serving
model = mlflow.pyfunc.load_model("models:/fraud-detector/production")
```

---

### 4. Data Pipeline

**Data pipelines** feed your ML system:

**Training pipeline**:
1. Extract data from sources (databases, logs, APIs)
2. Transform and clean data
3. Compute features
4. Store in offline feature store
5. Trigger model training

**Inference pipeline**:
1. Receive real-time events
2. Compute real-time features
3. Update online feature store
4. Serve to prediction service

**Example training pipeline** (Airflow):
```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'ml-team',
    'retries': 3,
    'retry_delay': timedelta(minutes=5)
}

dag = DAG(
    'fraud_detection_training',
    default_args=default_args,
    schedule_interval='@daily'
)

def extract_data(**context):
    # Pull data from database
    data = db.query("SELECT * FROM transactions WHERE date = {{ ds }}")
    return data

def compute_features(**context):
    # Feature engineering
    features = transform(context['task_instance'].xcom_pull(task_ids='extract'))
    return features

def train_model(**context):
    # Train and register model
    features = context['task_instance'].xcom_pull(task_ids='compute_features')
    model = train(features)
    mlflow.log_model(model, "fraud-detector")

extract = PythonOperator(task_id='extract', python_callable=extract_data, dag=dag)
compute = PythonOperator(task_id='compute_features', python_callable=compute_features, dag=dag)
train = PythonOperator(task_id='train_model', python_callable=train_model, dag=dag)

extract >> compute >> train
```

---

### 5. Monitoring & Observability

**Monitoring systems** track system health and model performance:

**Infrastructure metrics**:
- Request rate (requests/second)
- Latency (p50, p95, p99)
- Error rate (5xx errors)
- CPU/memory/GPU utilization

**Model metrics**:
- Prediction distribution
- Feature distribution
- Model confidence
- Ground truth accuracy (when labels available)

**Architecture**:
```
┌──────────────────────────────────────────────┐
│            Monitoring Stack                  │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Metrics (Prometheus)                  │ │
│  │  - System metrics                      │ │
│  │  - Model metrics                       │ │
│  │  - Business metrics                    │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Logs (ELK/CloudWatch)                 │ │
│  │  - Request/response logs               │ │
│  │  - Error logs                          │ │
│  │  - Audit logs                          │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Traces (Jaeger/Datadog)               │ │
│  │  - End-to-end request tracing          │ │
│  │  - Performance bottlenecks             │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Dashboards (Grafana)                  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Alerts (PagerDuty/Slack)              │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

See [Monitoring & Observability](./04-monitoring.md) for detailed implementation.

---

## System Design Patterns

### Pattern 1: Request-Response (Synchronous)

**Use case**: Real-time predictions with immediate response

```
Client → API Gateway → Prediction Service → Model → Response
```

**Characteristics**:
- Latency: < 100ms
- Throughput: 100-10,000 RPS
- Examples: Fraud detection, content moderation, search ranking

**Implementation**:
```python
# Synchronous prediction
@app.post("/predict")
async def predict(request: PredictionRequest):
    features = extract_features(request)
    prediction = model.predict(features)
    return {"result": prediction}
```

---

### Pattern 2: Batch Processing

**Use case**: High-throughput, non-time-sensitive predictions

```
Data Lake → Batch Processor → Model → Output Store
```

**Characteristics**:
- Latency: Minutes to hours
- Throughput: Millions of predictions
- Examples: Email campaign scoring, nightly recommendations

**Implementation**:
```python
# Batch prediction
def batch_predict(input_path, output_path):
    data = spark.read.parquet(input_path)

    # Predict in batches
    predictions = model.predict_batch(data)

    # Write results
    predictions.write.parquet(output_path)
```

---

### Pattern 3: Stream Processing

**Use case**: Continuous processing of events

```
Event Stream → Stream Processor → Model → Output Stream
```

**Characteristics**:
- Latency: < 1 second
- Throughput: 10,000-1M events/sec
- Examples: Real-time anomaly detection, live metrics

**Implementation**:
```python
# Stream processing (Kafka + Flink)
from pyflink.datastream import StreamExecutionEnvironment

env = StreamExecutionEnvironment.get_execution_environment()

# Read from Kafka
stream = env.add_source(FlinkKafkaConsumer(...))

# Apply model
predictions = stream.map(lambda x: {
    "id": x["id"],
    "prediction": model.predict(x["features"])
})

# Write to output
predictions.add_sink(FlinkKafkaProducer(...))

env.execute()
```

---

### Pattern 4: Async Predictions

**Use case**: Long-running inference with eventual results

```
Client → Submit Job → Queue → Worker → Result Store → Callback
```

**Characteristics**:
- Latency: Seconds to minutes
- Throughput: 100-1000 jobs/sec
- Examples: Video analysis, large document processing

**Implementation**:
```python
# Async prediction with Celery
from celery import Celery

app = Celery('tasks', broker='redis://localhost:6379')

@app.task
def predict_async(job_id, input_data):
    result = expensive_model.predict(input_data)

    # Store result
    db.store(job_id, result)

    # Notify client
    callback_url = db.get_callback(job_id)
    requests.post(callback_url, json=result)

# Submit job
@app.post("/predict_async")
async def submit_prediction(request: PredictionRequest):
    job_id = str(uuid.uuid4())
    predict_async.delay(job_id, request.dict())
    return {"job_id": job_id, "status_url": f"/status/{job_id}"}
```

---

## Putting It All Together

Here's a complete reference architecture for a production ML system:

```
┌───────────────────────────────────────────────────────────────┐
│                         Clients                                │
│              (Web, Mobile, Backend Services)                   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    API Gateway                                 │
│         (Auth, Rate Limiting, Load Balancing)                  │
└───────────────────────┬───────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Prediction Service  │    │   Fallback Service   │
│  (Primary Model)     │    │   (Simple Model)     │
└──────────┬───────────┘    └──────────────────────┘
           │
           ├── Cache (Redis)
           │
           ├── Feature Store (Online)
           │   ├── Precomputed features
           │   └── Real-time features
           │
           └── Model Registry
               └── Versioned models


┌───────────────────────────────────────────────────────────────┐
│                  Monitoring & Alerting                         │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Prometheus  │  │     Logs     │  │    Traces    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                │
│  ┌──────────────────────────────────────────────────┐        │
│  │              Grafana Dashboards                  │        │
│  └──────────────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────┐
│                   Training Pipeline                            │
│                                                                │
│  Data Sources → ETL → Feature Store (Offline) → Training      │
│                                         │                      │
│                                         ▼                      │
│                              Model Registry (New Version)      │
│                                         │                      │
│                                         ▼                      │
│                              Evaluation & Testing              │
│                                         │                      │
│                                         ▼                      │
│                              Deploy to Production              │
└───────────────────────────────────────────────────────────────┘
```

---

## Design Checklist

When designing your production ML system, ensure you've addressed:

**Reliability**:
- [ ] Fallback mechanisms for model failures
- [ ] Retry logic for transient errors
- [ ] Circuit breakers to prevent cascading failures
- [ ] Health checks and automatic recovery

**Scalability**:
- [ ] Horizontal scaling (add more instances)
- [ ] Auto-scaling based on load
- [ ] Request batching for efficiency
- [ ] Caching for repeated queries

**Observability**:
- [ ] Comprehensive logging
- [ ] Real-time metrics (latency, throughput, errors)
- [ ] Distributed tracing
- [ ] Alerting on anomalies

**Performance**:
- [ ] Latency targets defined (p50, p95, p99)
- [ ] Load testing completed
- [ ] Model optimization (quantization, pruning)
- [ ] Resource limits set

**Deployment**:
- [ ] CI/CD pipeline for models
- [ ] Canary/blue-green deployment
- [ ] Rollback procedures
- [ ] Version management

---

## Next Steps

Now that you understand the overall architecture, dive deeper:

- **[Infrastructure Patterns](./02-infrastructure-patterns.md)**: Choose the right deployment pattern (serverless, containers, Kubernetes)
- **[Data Pipelines](./03-data-pipelines.md)**: Build robust data pipelines
- **[Monitoring & Observability](./04-monitoring.md)**: Implement comprehensive monitoring

---

## Summary

A production ML system consists of:
1. **Prediction Service**: Serves inference requests
2. **Feature Store**: Manages features consistently
3. **Model Registry**: Versions and deploys models
4. **Data Pipeline**: Feeds the system with data
5. **Monitoring**: Tracks health and performance

Design for **reliability**, **scalability**, and **observability** from day one.

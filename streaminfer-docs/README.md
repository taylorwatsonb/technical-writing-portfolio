# StreamInfer API Documentation

**Real-time Machine Learning Inference at Scale**

---

## Welcome to StreamInfer

StreamInfer is a high-performance API for deploying and serving machine learning models with low latency and high throughput. Whether you're deploying your first model or optimizing a production inference pipeline, StreamInfer provides the tools and flexibility you need.

## What You'll Find Here

This documentation will help you:

- **Get started quickly** with your first model deployment
- **Understand core concepts** like endpoints, versions, and request routing
- **Integrate StreamInfer** into your applications with our Python and JavaScript SDKs
- **Optimize performance** for production workloads
- **Troubleshoot issues** and follow best practices

## Documentation Structure

### 🚀 [Getting Started](./getting-started.md)
New to StreamInfer? Start here to understand the basics and deploy your first model.

### ⚡ [Quickstart](./quickstart.md)
Deploy a model in under 5 minutes with our step-by-step quickstart guide.

### 📚 [API Reference](./api-reference.md)
Complete reference for the StreamInfer REST API, including all endpoints, parameters, and response schemas.

### 🐍 [Python SDK Guide](./python-sdk.md)
Detailed guide for using the StreamInfer Python SDK in your applications.

### 🔧 [Configuration](./configuration.md)
Configure model endpoints, scaling policies, and optimization settings.

### 📊 [Best Practices](./best-practices.md)
Production-ready patterns for authentication, error handling, monitoring, and scaling.

### 🔍 [Troubleshooting](./troubleshooting.md)
Common issues and how to resolve them.

---

## Key Concepts

Before diving in, here are the core concepts you'll work with:

### Models
A trained ML model that you want to deploy. StreamInfer supports models in ONNX, TensorFlow SavedModel, PyTorch, and custom formats.

### Endpoints
A deployed instance of your model accessible via HTTP. Each endpoint has a unique URL and can serve multiple model versions.

### Versions
Different iterations of your model. StreamInfer supports A/B testing and gradual rollouts between versions.

### Inference Requests
HTTP requests containing input data that your model processes and returns predictions.

---

## Example: Your First Inference Request

```python
import streaminfer

# Initialize the client
client = streaminfer.Client(api_key="your_api_key")

# Deploy a model
endpoint = client.deploy(
    model_path="./my_model.onnx",
    endpoint_name="sentiment-classifier"
)

# Make an inference request
result = endpoint.predict({
    "text": "This product is amazing!"
})

print(result)
# Output: {"sentiment": "positive", "confidence": 0.94}
```

---

## Need Help?

- **API Reference**: Detailed endpoint documentation at [api-reference.md](./api-reference.md)
- **SDK Examples**: More code examples in [python-sdk.md](./python-sdk.md)
- **Common Issues**: Check [troubleshooting.md](./troubleshooting.md)

---

## What's Next?

1. **New users**: Start with the [Getting Started Guide](./getting-started.md)
2. **Quick deployment**: Jump to the [Quickstart](./quickstart.md)
3. **API integration**: Explore the [API Reference](./api-reference.md)
4. **Production deployment**: Read [Best Practices](./best-practices.md)

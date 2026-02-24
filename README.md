# Login Node + React with Complete Observability Stack

This repository contains a microservices application with **production-grade observability**:
- **backend**: Node.js + Express + PostgreSQL (JWT auth) with metrics & tracing
- **campaign-service**: Campaign/donation API with Redis caching
- **backend-consumer**: Kafka consumer for async processing
- **frontend**: React (Vite) with JWT authentication
- **observability**: Prometheus + Grafana + Jaeger + ELK Stack (Elasticsearch + Kibana + Filebeat)

## 🚀 Quick Start (requires Docker)

```powershell
# Clone and navigate to repository
cd f:\bugs-api-avengers

# Start all services (first time: ~2-3 minutes)
docker-compose up -d --build

# Check status
docker-compose ps

# Run demo trace
.\demo-tracing.ps1

# Run stress test
node stress-test.js campaigns 100 10
```

## 🌐 Services & Access Points

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **Application** | http://localhost | - | Frontend + API |
| **Jaeger (Tracing)** | http://localhost:16686 | - | Distributed tracing UI |
| **Kibana (Logs)** | http://localhost/kibana | - | Log search & analysis |
| **Grafana (Metrics)** | http://localhost/grafana | admin / grafana | Metrics dashboards |
| **Prometheus** | http://localhost/prometheus | - | Metrics storage |

### Internal Services
- Backend: Port 4000 (JWT auth, Kafka producer)
- Campaign Service: Port 5000 (campaigns, Redis cache)
- Backend Consumer: Port 9091 (Kafka consumer, metrics)
- PostgreSQL: Port 5432 (database)
- Redis: Port 6379 (cache)
- Kafka: Port 9092 (message queue)
- Elasticsearch: Port 9200 (log storage)

## Grafana Access

- URL: http://localhost:3000
- **Anonymous access enabled** (no login required)
- Optional login: `admin` / `grafana`
- Pre-configured dashboard: "Login App Observability Dashboard"

## 📊 Complete Observability Stack

### 🔍 Distributed Tracing (Jaeger)
- **End-to-end request tracking** across all microservices
- **OpenTelemetry** automatic instrumentation
- **Correlation IDs** to link traces with logs
- View at: http://localhost:16686

### 📝 Centralized Logging (ELK Stack)
- **Elasticsearch**: Stores all container logs
- **Filebeat**: Collects logs automatically from Docker
- **Kibana**: Search and analyze logs
- Separate indices per service
- View at: http://localhost/kibana

### 📈 Metrics Monitoring (Prometheus + Grafana)
**30+ Custom Metrics Including:**
- HTTP request duration (P50, P95, P99)
- Request rate per service
- Cache hit/miss rates (Redis)
- Database query performance
- Kafka consumer lag
- Node.js heap & event loop

**5 Grafana Dashboards:**
1. System Overview (all services health)
2. Backend Service (JWT auth, HTTP metrics)
3. Campaign Service (cache, Redis, campaigns)
4. Backend Consumer (Kafka lag, processing)
5. Database (connections, queries, locks)

### 🚨 Proactive Alerting
**25+ Alert Rules:**
- High CPU/memory usage (70% warning, 90% critical)
- Service down detection (30s)
- High error rates (5% warning, 15% critical)
- Slow response times (>2s warning, >5s critical)
- Database connection pool exhaustion
- Cache hit rate degradation
- Kafka consumer lag (>100 warning, >1000 critical)

## 🎯 End-to-End Tracing Demo

### Quick Demo (1 minute)
```powershell
# Run automated demo
.\demo-tracing.ps1

# Then view in:
# Jaeger: http://localhost:16686 (search for correlation ID)
# Kibana: http://localhost/kibana (search for correlation ID)
```

### Manual Trace Example
```powershell
# Register with correlation ID
$headers = @{
    "Content-Type" = "application/json"
    "X-Correlation-ID" = "my-trace-123"
}
$body = @{
    email = "test@example.com"
    password = "Test123!@#"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost/api/register" -Method POST -Headers $headers -Body $body

# View trace in Jaeger: http://localhost:16686
# Search logs in Kibana: my-trace-123
```

## 🔥 Stress Testing

```powershell
# Normal load (100 requests, 10 concurrent)
node stress-test.js campaigns 100 10

# Medium load (500 requests, 20 concurrent)
node stress-test.js register 500 20

# High load (1000 requests, 50 concurrent - triggers alerts!)
node stress-test.js login 1000 50
```

**Available scenarios:**
- `register`: Create new users
- `login`: Authenticate users
- `campaigns`: Fetch campaign list
- `campaign-detail`: Get campaign details

**Results include:**
- P50, P95, P99 latency
- Success/failure rate
- Requests per second
- Error breakdown

## 🧪 Failure Injection Tests

```powershell
# Test database failure
docker stop login_db
node stress-test.js campaigns 50 5
docker start login_db

# Test Redis cache failure
docker stop campaign_redis
node stress-test.js campaigns 50 5  # Still works, slower
docker start campaign_redis

# Test Kafka consumer lag
docker stop login_backend_consumer
node stress-test.js register 100 10  # Messages pile up
docker start login_backend_consumer  # Consumer catches up
```

## CI/CD

The GitHub Actions workflow deploys to Azure VM on push to main.
Set repository secrets:
- `AZURE_VM_IP`
- `AZURE_VM_KEY` (SSH private key)

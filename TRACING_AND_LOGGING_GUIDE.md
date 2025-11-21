# End-to-End Tracing and Logging Guide

## 🎯 Overview

This system implements comprehensive **distributed tracing** and **centralized logging** to track every request through your microservices architecture.

## 🏗️ Architecture

```
User Request → Backend → Campaign Service → Kafka → Backend Consumer
     ↓              ↓            ↓              ↓            ↓
  Jaeger       Jaeger      Jaeger         Jaeger      Jaeger
     ↓              ↓            ↓              ↓            ↓
  Filebeat ←───── Elasticsearch ──────────────────────────→ Kibana
```

### Components

1. **OpenTelemetry**: Automatic instrumentation for Node.js services
2. **Jaeger**: Distributed tracing UI at http://localhost:16686
3. **Elasticsearch**: Centralized log storage
4. **Filebeat**: Log collection from Docker containers
5. **Kibana**: Log analysis and visualization at http://localhost/kibana

## 🚀 Quick Start

### 1. Start All Services

```powershell
docker-compose up -d --build
```

Wait for all services to be healthy (~2 minutes).

### 2. Access Monitoring UIs

- **Jaeger (Tracing)**: http://localhost:16686
- **Kibana (Logs)**: http://localhost/kibana
- **Grafana (Metrics)**: http://localhost/grafana
- **Prometheus**: http://localhost/prometheus

### 3. Run Stress Test

```powershell
# Test campaign endpoint (100 requests, 10 concurrent)
node stress-test.js campaigns 100 10

# Test registration (500 requests, 20 concurrent)
node stress-test.js register 500 20

# Test login (1000 requests, 50 concurrent - HIGH LOAD)
node stress-test.js login 1000 50
```

## 📊 View Traces in Jaeger

### Step 1: Open Jaeger UI
Navigate to http://localhost:16686

### Step 2: Select Service
- Choose service: `backend`, `campaign-service`, or `backend-consumer`
- Click "Find Traces"

### Step 3: View Trace Details
Click on any trace to see:
- **Span timeline**: Visual representation of request flow
- **Service dependencies**: Which services were called
- **Latency breakdown**: Time spent in each service
- **Errors**: Red spans indicate failures

### Step 4: Follow a Single Request
Look for traces with:
- Multiple spans (indicates request went through multiple services)
- Same `correlation.id` attribute across spans

## 🔍 Search Logs in Kibana

### Initial Setup (First Time Only)

1. Open http://localhost/kibana
2. Click "Discover" in left menu
3. Click "Create data view"
4. Index pattern: `*-logs-*`
5. Timestamp field: `@timestamp`
6. Click "Save data view to Kibana"

### Search Logs

#### Filter by Service
```
docker.container.name: "login_backend"
docker.container.name: "campaign_service"
docker.container.name: "login_backend_consumer"
```

#### Search by Correlation ID
```
message: "*stress-test-*"
```

#### Find Errors
```
log.level: "error" OR message: "*error*"
```

#### Time Range
- Click time picker (top right)
- Select "Last 15 minutes" for recent tests
- Or use "Last 1 hour" for broader view

### Example Queries

**All registration events:**
```
message: "*register*" AND docker.container.name: "login_backend"
```

**All Kafka messages:**
```
docker.container.name: "login_backend_consumer" AND message: "*processed*"
```

**High latency requests:**
```
message: "*Duration*" AND message: ">1000"
```

## 🧪 End-to-End Tracing Demo

### Scenario: Track a Single User Registration

#### Step 1: Create a Test User
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-Correlation-ID" = "demo-trace-12345"
}
$body = @{
    email = "tracetest@example.com"
    password = "Test123!@#"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost/api/register" -Method POST -Headers $headers -Body $body
```

#### Step 2: Find Trace in Jaeger
1. Open http://localhost:16686
2. Service: `backend`
3. Tags: `correlation.id=demo-trace-12345`
4. Click "Find Traces"

You should see:
- **Span 1**: POST /api/register (backend)
- **Span 2**: INSERT INTO users (PostgreSQL)
- **Span 3**: Kafka producer send (KafkaJS)

#### Step 3: Find Logs in Kibana
1. Open http://localhost/kibana
2. Search: `demo-trace-12345`
3. See logs from all services with same correlation ID

#### Step 4: Check Kafka Consumer
1. In Jaeger, search for `backend-consumer` service
2. Look for spans with `correlation-id` header
3. Verify message was processed

## 🔥 Stress Test Scenarios

### Scenario 1: Normal Load (Baseline)
```powershell
node stress-test.js campaigns 100 10
```

**Expected Results:**
- Success rate: >99%
- P95 latency: <500ms
- No alerts in Grafana

### Scenario 2: Medium Load
```powershell
node stress-test.js register 500 20
```

**Expected Results:**
- Success rate: >95%
- P95 latency: <1000ms
- Kafka lag increases but stays <100

### Scenario 3: High Load (Stress)
```powershell
node stress-test.js login 1000 50
```

**Expected Results:**
- Success rate: >90%
- P95 latency: <2000ms
- Alerts fire for high latency
- CPU usage spikes visible in Grafana

### Scenario 4: Extreme Load (Breaking Point)
```powershell
node stress-test.js campaigns 5000 100
```

**Expected Results:**
- Some requests fail (connection pool exhausted)
- P95 latency: >5000ms
- Critical alerts fire
- Database connection pool saturated
- Redis cache hit rate drops

## 🚨 Failure Injection Tests

### Test 1: Database Failure
```powershell
# Stop database
docker stop login_db

# Run test - should see errors
node stress-test.js campaigns 50 5

# Start database
docker start login_db
```

**What to Observe:**
- Jaeger: Red error spans in `campaign-service`
- Kibana: Database connection errors
- Grafana: Database alerts fire

### Test 2: Redis Cache Failure
```powershell
# Stop Redis
docker stop campaign_redis

# Run test - should still work (fallback to DB)
node stress-test.js campaigns 50 5

# Start Redis
docker start campaign_redis
```

**What to Observe:**
- Slower response times (no cache)
- Cache miss rate = 100%
- More database queries

### Test 3: Kafka Consumer Stopped
```powershell
# Stop consumer
docker stop login_backend_consumer

# Register users (Kafka messages pile up)
node stress-test.js register 100 10

# Check lag in Grafana
# Start consumer
docker start login_backend_consumer

# Watch lag decrease
```

**What to Observe:**
- Kafka lag increases in Grafana
- Consumer lag alert fires
- Messages processed in batch when consumer restarts

## 📈 Key Metrics to Monitor

### In Jaeger
- **Trace duration**: Total time for request
- **Service dependencies**: Which services are called
- **Error rate**: Red spans indicate failures

### In Kibana
- **Log volume**: Requests per minute
- **Error logs**: Filter by `log.level: error`
- **Correlation IDs**: Track single requests

### In Grafana
- **CPU/Memory**: Resource usage per service
- **Request rate**: HTTP requests per second
- **Error rate**: Failed requests percentage
- **Latency**: P50, P95, P99 response times
- **Kafka lag**: Consumer lag per partition
- **Cache hit rate**: Redis cache effectiveness

## 🎓 Best Practices

### 1. Always Use Correlation IDs
```javascript
const correlationId = req.headers['x-correlation-id'] || 
                     `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### 2. Log with Context
```javascript
console.log(`[${correlationId}] User registered: ${email}`);
```

### 3. Add Trace Attributes
```javascript
const span = trace.getActiveSpan();
if (span) {
  span.setAttribute('user.email', email);
  span.setAttribute('operation.type', 'registration');
}
```

### 4. Handle Errors Gracefully
```javascript
try {
  // Your code
} catch (error) {
  console.error(`[${correlationId}] Error:`, error);
  span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  throw error;
}
```

## 🔧 Troubleshooting

### Jaeger Not Showing Traces
1. Check service logs: `docker logs login_backend`
2. Verify OTEL environment variables in docker-compose.yml
3. Ensure Jaeger is healthy: `docker ps | grep jaeger`

### Kibana Not Showing Logs
1. Wait 30 seconds for Filebeat to collect logs
2. Verify data view exists (Discover → Data Views)
3. Check Filebeat status: `docker logs login_filebeat`

### No Metrics in Grafana
1. Check Prometheus targets: http://localhost/prometheus/targets
2. All targets should be "UP"
3. Verify service exposes /metrics endpoint

## 📚 Additional Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/instrumentation/js/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Elastic Stack Guide](https://www.elastic.co/guide/index.html)

## 🎯 Success Criteria

Your tracing and logging implementation is successful if you can:

✅ **Trace a single request** through all services using correlation ID
✅ **View complete span timeline** in Jaeger with <1s delay
✅ **Search logs by correlation ID** in Kibana and find all related logs
✅ **Identify bottlenecks** by analyzing span durations
✅ **Detect failures** immediately through red spans and error logs
✅ **Correlate metrics with traces** using timestamps
✅ **Run stress tests** and observe system behavior under load
✅ **Inject failures** and track error propagation through traces

---

**Generated**: November 21, 2025
**Version**: 1.0
**Maintained by**: Bugs API Avengers Team

# CI/CD and New Services Integration Guide

## Overview
This document describes the integration of three new services (donation-service, payment-service, notification-service) into the complete observability stack and the CI/CD pipeline with selective Docker builds.

## 🎯 What Was Implemented

### 1. Donation Service - Full Observability

#### **OpenTelemetry Tracing**
- Created `donation-service/src/tracing.js` with auto-instrumentation for:
  - Express HTTP requests
  - KafkaJS message publishing
- Updated `donation-service/src/index.js` to initialize tracing before other imports
- Added OTEL environment variables in `docker-compose.yml`:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
  - `OTEL_SERVICE_NAME=donation-service`

#### **Prometheus Metrics**
Added custom metrics to `donation-service/src/index.js`:
- `donations_total` - Counter tracking donations by status and campaign
- `donation_amount_usd` - Histogram of donation amounts (buckets: 1, 5, 10, 25, 50, 100, 250, 500, 1000)
- `idempotency_cache_size` - Gauge showing cache entries
- `idempotency_hits_total` - Counter for duplicate requests prevented
- `donation_http_request_duration_seconds` - Histogram of HTTP latency by method, route, status

Metrics endpoint: `http://donation-service:6000/metrics`

#### **Prometheus Scrape Configuration**
Updated `prometheus/prometheus.yml` to add donation-service scrape target:
```yaml
- job_name: "donation-service"
  scrape_interval: 15s
  static_configs:
  - targets: ["donation-service:6000"]
  relabel_configs:
  - source_labels: [__address__]
    target_label: service
    replacement: donation-service
```

#### **Grafana Dashboard**
Created `grafana/dashboards/donation-service-dashboard.json` with 10 panels:
1. Donations/sec (stat)
2. Total Donations USD (stat)
3. Idempotency Cache Size (stat)
4. Duplicate Requests Prevented/sec (stat)
5. Donation Rate by Status (timeseries)
6. Donation Amount Distribution - p50, p95, p99 (timeseries)
7. HTTP Request Latency - p50, p95, p99 (timeseries)
8. HTTP Requests by Status Code (timeseries)
9. Memory Usage (timeseries)
10. CPU Usage (timeseries)

#### **Filebeat Logging**
Updated `filebeat.yml` to collect logs from donation_service container:
```yaml
- equals:
    container.name: "donation_service"
```

Logs are routed to:
- `registration-logs-*` index if message contains "register"
- `filebeat-*` index for all other logs

### 2. Payment Service - Tracing Integration

#### **OpenTelemetry Tracing**
- Created `payment-service/src/tracing.js` with auto-instrumentation for:
  - KafkaJS consumer
  - PostgreSQL database operations
- Updated `payment-service/src/index.js` to require tracing first
- Added OTEL environment variables in `docker-compose.yml`:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
  - `OTEL_SERVICE_NAME=payment-service`

#### **Logging**
Added to filebeat.yml filters:
```yaml
- equals:
    container.name: "payment_service"
- equals:
    container.name: "payment_db"
```

#### **Package Updates**
Added OpenTelemetry dependencies to `payment-service/package.json`:
- `@opentelemetry/sdk-node@^0.41.0`
- `@opentelemetry/auto-instrumentations-node@^0.37.0`
- `@opentelemetry/exporter-trace-otlp-http@^0.41.0`
- `@opentelemetry/resources@^1.15.0`
- `@opentelemetry/semantic-conventions@^1.15.0`

### 3. Notification Service - Tracing Integration

#### **OpenTelemetry Tracing**
- Created `notification-service/src/tracing.js` with auto-instrumentation for KafkaJS
- Updated `notification-service/src/index.js` to require tracing first
- Added OTEL environment variables in `docker-compose.yml`:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
  - `OTEL_SERVICE_NAME=notification-service`

#### **Logging**
Added to filebeat.yml filters:
```yaml
- equals:
    container.name: "notification_service"
```

#### **Package Updates**
Added OpenTelemetry dependencies to `notification-service/package.json` (same as payment-service)

### 4. Stress Testing Updates

Updated `stress-test.js` to include donation testing scenarios:

#### **New Scenarios**
1. **`donate`** - Random donation amounts ($5-$105) with unique idempotency keys
2. **`donate-idempotent`** - Fixed $50 donation with SAME idempotency key for all requests (tests duplicate prevention)

#### **Authentication Flow**
- Scenarios can now require authentication (`requiresAuth: true`)
- Automatic login before authenticated scenarios
- Token capture and propagation via `onSuccess` callback
- Bearer token injection in Authorization header

#### **Idempotency Testing**
- Unique idempotency keys: `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`
- Same key for all requests: `'SAME-KEY-FOR-ALL-REQUESTS'`
- Tracks duplicate prevention via `idempotency_hits_total` metric

#### **Usage Examples**
```bash
# Test donations with 100 requests, 10 concurrent
node stress-test.js donate 100 10

# Test idempotency (should see many 200 responses with "replayed: true")
node stress-test.js donate-idempotent 50 10

# Test existing scenarios
node stress-test.js register 200 20
node stress-test.js campaigns 500 50
```

### 5. CI/CD Pipeline with Selective Builds

Created `.github/workflows/docker-build.yml` with intelligent change detection.

#### **Features**

**1. Change Detection**
- Uses `git diff` to detect modified service directories
- Compares with previous commit (push) or base branch (PR)
- Only builds services that have changed

**2. Service Matrix**
- backend
- backend-consumer
- campaign-service
- donation-service
- payment-service
- notification-service
- frontend

**3. Triggers**
```yaml
on:
  push:
    branches: [ "main", "develop" ]
    paths:
      - 'backend/**'
      - 'backend-consumer/**'
      # ... other service paths
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:
    inputs:
      force_build_all:
        description: 'Force build all services'
        type: boolean
        default: false
```

**4. Image Tagging Strategy**
- Branch name (e.g., `main`, `develop`)
- Git SHA with branch prefix (e.g., `main-abc1234`)
- `latest` tag only on default branch

**5. Build Caching**
- Uses Docker layer caching via registry
- Cache key: `{username}/{service}:buildcache`
- Speeds up subsequent builds

**6. Required Secrets**
You must configure these in GitHub Settings → Secrets:
- `DOCKERHUB_USERNAME` - Your DockerHub username
- `DOCKERHUB_TOKEN` - DockerHub access token (not password!)

#### **DockerHub Setup**

1. **Create Access Token**
   - Go to https://hub.docker.com/settings/security
   - Click "New Access Token"
   - Name: `github-actions`
   - Access permissions: Read, Write, Delete
   - Copy the token (shown once)

2. **Configure GitHub Secrets**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `DOCKERHUB_USERNAME` with your DockerHub username
   - Add `DOCKERHUB_TOKEN` with the token from step 1

3. **Verify Workflow**
   - Push a change to any service directory
   - Go to Actions tab in GitHub
   - Watch the `detect-changes` job output to see which services were detected
   - Only changed services will build and push

#### **Workflow Jobs**

```
detect-changes (runs first)
  ├─ Checks which service directories changed
  └─ Sets output flags: backend=true/false, frontend=true/false, etc.

build-backend (conditional)
  ├─ Runs only if detect-changes.outputs.backend == 'true'
  ├─ Builds backend/Dockerfile
  └─ Pushes to docker.io/{username}/backend:latest

build-backend-consumer (conditional)
  ├─ Runs only if detect-changes.outputs.backend-consumer == 'true'
  └─ ...

... (same pattern for all 7 services)

summary (always runs)
  └─ Displays build summary table in GitHub Actions UI
```

#### **Manual Trigger**
Force rebuild all services regardless of changes:
```
1. Go to Actions tab
2. Select "Build and Push Docker Images to DockerHub"
3. Click "Run workflow"
4. Check "Force build all services"
5. Click "Run workflow"
```

## 📊 Monitoring & Observability

### **Jaeger Tracing**
View end-to-end donation workflow:
1. Open http://localhost/jaeger/
2. Select service: `donation-service`
3. Search for traces
4. See trace propagation through:
   - donation-service → Kafka
   - payment-service (consumer)
   - notification-service (consumer)

### **Prometheus Metrics**
Query donation metrics:
- `rate(donations_total[5m])` - Donation rate
- `histogram_quantile(0.95, rate(donation_amount_usd_bucket[5m]))` - P95 donation amount
- `idempotency_hits_total` - Total duplicates prevented

### **Grafana Dashboards**
Access http://localhost/grafana:
- **Donation Service Dashboard** - Full donation metrics
- **Backend Service Dashboard** - Auth and registration
- **Campaign Service Dashboard** - Campaign queries
- **System Overview** - All services health

### **Kibana Logs**
View logs at http://localhost/kibana:
- Data view: `filebeat-*` for all logs
- Data view: `registration-logs-*` for registration-specific logs
- Filter by container: `container.name: "donation_service"`
- Search donations: `message: "donation"`

## 🚀 Deployment Instructions

### **1. Update Dependencies**
For each modified service, rebuild the Docker image:
```bash
cd donation-service && npm install
cd ../payment-service && npm install
cd ../notification-service && npm install
```

### **2. Rebuild and Start Services**
```bash
docker-compose down
docker-compose up --build -d
```

### **3. Verify Observability**

**Check Metrics Endpoints:**
```bash
curl http://localhost/api/campaigns/health  # Should see campaign-service
curl http://localhost:6000/health           # Donation service
curl http://localhost:6000/metrics          # Prometheus metrics
```

**Check Jaeger:**
- Open http://localhost:16686
- Select `donation-service`
- Run: `node stress-test.js donate 10 2`
- Refresh Jaeger and view traces

**Check Prometheus:**
- Open http://localhost/prometheus
- Query: `donations_total`
- Should see metrics appear after running stress test

**Check Grafana:**
- Open http://localhost/grafana
- Go to Dashboards → Donation Service Dashboard
- Run stress test and watch metrics update in real-time

**Check Kibana:**
- Open http://localhost/kibana
- Go to Discover
- Select `filebeat-*` data view
- Filter: `container.name: "donation_service"`
- Run stress test and see logs appear

### **4. Test CI/CD Pipeline**

**Method 1: Commit and Push**
```bash
# Make a change to donation-service
echo "// test change" >> donation-service/src/index.js

# Commit and push
git add donation-service/
git commit -m "test: trigger donation-service build"
git push origin main

# Watch GitHub Actions
# Only donation-service should build
```

**Method 2: Manual Workflow Trigger**
1. Go to GitHub repo → Actions tab
2. Select "Build and Push Docker Images to DockerHub"
3. Click "Run workflow"
4. Optionally check "Force build all services"
5. Click green "Run workflow" button

**Verify on DockerHub:**
1. Go to https://hub.docker.com
2. Login and check your repositories
3. You should see new images with tags:
   - `{username}/donation-service:latest`
   - `{username}/donation-service:main-{sha}`

## 📈 Performance Testing

### **Load Test Donation Service**
```bash
# Light load - 100 requests, 10 concurrent
node stress-test.js donate 100 10

# Medium load - 500 requests, 50 concurrent
node stress-test.js donate 500 50

# Heavy load - 1000 requests, 100 concurrent
node stress-test.js donate 1000 100

# Test idempotency - should prevent duplicates
node stress-test.js donate-idempotent 100 20
```

### **Expected Results**
- P95 latency: < 2s
- P99 latency: < 5s
- Success rate: > 95%
- Idempotency hits: ~95% for `donate-idempotent` scenario

## 🔍 Troubleshooting

### **Issue: Metrics not appearing in Prometheus**
```bash
# Check if donation-service is running
docker ps | grep donation_service

# Check metrics endpoint
curl http://localhost:6000/metrics

# Check Prometheus targets
# Open http://localhost/prometheus/targets
# donation-service:6000 should be UP
```

### **Issue: No traces in Jaeger**
```bash
# Check Jaeger is running
docker ps | grep jaeger

# Check OTEL environment variables
docker exec donation_service env | grep OTEL

# Restart donation-service
docker-compose restart donation-service
```

### **Issue: Logs not in Kibana**
```bash
# Check Filebeat is running
docker ps | grep filebeat

# Check Filebeat logs
docker logs login_filebeat

# Verify Elasticsearch indices
curl http://localhost:9200/_cat/indices?v | grep filebeat

# Restart Filebeat
docker-compose restart filebeat
```

### **Issue: CI/CD not building services**
1. Check workflow file syntax: `.github/workflows/docker-build.yml`
2. Verify secrets are set in GitHub repo settings
3. Check Actions tab for error messages
4. Ensure service paths match directory names exactly
5. Try manual trigger with "Force build all services"

### **Issue: DockerHub push fails**
1. Verify `DOCKERHUB_TOKEN` is an access token, not password
2. Check token has Read, Write, Delete permissions
3. Ensure `DOCKERHUB_USERNAME` matches exactly
4. Check DockerHub rate limits (anonymous: 100 pulls/6hrs, authenticated: 200 pulls/6hrs)

## 📝 Files Modified/Created

### **Created Files**
- `donation-service/src/tracing.js`
- `payment-service/src/tracing.js`
- `notification-service/src/tracing.js`
- `grafana/dashboards/donation-service-dashboard.json`
- `.github/workflows/docker-build.yml`
- `NEW_SERVICES_INTEGRATION.md` (this file)

### **Modified Files**
- `donation-service/src/index.js` - Added tracing, metrics, /metrics endpoint
- `donation-service/package.json` - Added prom-client and OpenTelemetry deps
- `payment-service/src/index.js` - Added tracing initialization
- `payment-service/package.json` - Added OpenTelemetry deps
- `notification-service/src/index.js` - Added tracing initialization
- `notification-service/package.json` - Added OpenTelemetry deps
- `docker-compose.yml` - Added OTEL env vars for 3 services
- `prometheus/prometheus.yml` - Added donation-service scrape target
- `filebeat.yml` - Added donation_service, payment_service, notification_service, payment_db filters
- `stress-test.js` - Added donate and donate-idempotent scenarios with auth

## 🎉 Summary

All new services are now fully integrated with:
- ✅ OpenTelemetry distributed tracing (Jaeger)
- ✅ Prometheus metrics collection
- ✅ Grafana dashboards
- ✅ Filebeat log aggregation (Elasticsearch/Kibana)
- ✅ Stress testing scenarios
- ✅ CI/CD pipeline with selective Docker builds to DockerHub

The system provides complete observability for the donation workflow from donation-service → payment-service → notification-service with end-to-end tracing, metrics, and logs.

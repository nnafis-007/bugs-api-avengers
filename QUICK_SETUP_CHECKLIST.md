# Quick Setup Checklist - CI/CD & New Services

## ✅ What's Been Implemented

### 🎯 Donation Service (Port 6000)
- [x] OpenTelemetry tracing with auto-instrumentation
- [x] Prometheus metrics (5 custom metrics)
- [x] Grafana dashboard (10 panels)
- [x] Filebeat log collection
- [x] Nginx routing configured
- [x] Stress test scenarios added

### 🎯 Payment Service
- [x] OpenTelemetry tracing with Kafka + PostgreSQL instrumentation
- [x] Filebeat log collection (payment_service + payment_db)
- [x] Package.json updated with OTEL dependencies

### 🎯 Notification Service
- [x] OpenTelemetry tracing with Kafka instrumentation
- [x] Filebeat log collection
- [x] Package.json updated with OTEL dependencies

### 🎯 CI/CD Pipeline
- [x] Change detection using git diff
- [x] Selective builds (only modified services)
- [x] DockerHub push with multi-tag strategy
- [x] Build caching for faster builds
- [x] Manual trigger option
- [x] Build summary in GitHub Actions

## 🚀 Next Steps to Deploy

### 1. Configure GitHub Secrets
Before the CI/CD pipeline can work, add these secrets to your GitHub repository:

**Steps:**
1. Go to your GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add these two secrets:

**Secret 1: DOCKERHUB_USERNAME**
- Name: `DOCKERHUB_USERNAME`
- Value: Your DockerHub username (e.g., `johndoe`)

**Secret 2: DOCKERHUB_TOKEN**
- Name: `DOCKERHUB_TOKEN`
- Value: Your DockerHub access token (NOT your password)

**To create a DockerHub access token:**
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name: `github-actions`
4. Permissions: Read, Write, Delete
5. Copy the token (shown only once!)
6. Paste it as the secret value in GitHub

### 2. Install New Dependencies
Run this in each service directory:

```bash
# Donation service
cd donation-service
npm install

# Payment service
cd ../payment-service
npm install

# Notification service
cd ../notification-service
npm install
```

### 3. Rebuild Docker Containers
```bash
cd f:/bugs-api-avengers
docker-compose down
docker-compose up --build -d
```

### 4. Verify Services are Running
```bash
# Check all containers are running
docker ps

# Should see these containers:
# - donation_service
# - payment_service
# - notification_service
# - login_backend
# - campaign_service
# - login_backend_consumer
# - login_frontend
# - login_nginx
# - login_prometheus
# - login_grafana
# - jaeger
# - kibana
# - elasticsearch
# - filebeat
# (and more...)
```

### 5. Test Donation Service
```bash
# Check health endpoint
curl http://localhost/api/donate

# Check metrics endpoint
curl http://localhost:6000/metrics

# Run stress test (requires login first)
node stress-test.js donate 50 10
```

### 6. Verify Observability

#### **Jaeger (Tracing)**
1. Open http://localhost/jaeger/
2. Select service: `donation-service`
3. Click "Find Traces"
4. You should see traces after running stress test

#### **Prometheus (Metrics)**
1. Open http://localhost/prometheus
2. Go to Status → Targets
3. Verify `donation-service:6000` is UP
4. Query: `donations_total`
5. Should show metrics after stress test

#### **Grafana (Dashboards)**
1. Open http://localhost/grafana
2. Username: `admin`, Password: `grafana`
3. Go to Dashboards
4. Open "Donation Service Dashboard"
5. Run stress test and watch metrics update

#### **Kibana (Logs)**
1. Open http://localhost/kibana
2. Go to Discover
3. Select data view: `filebeat-*`
4. Add filter: `container.name: "donation_service"`
5. Run stress test and see logs appear

### 7. Test CI/CD Pipeline

#### **Option A: Automatic Trigger (Recommended)**
```bash
# Make a small change to donation-service
echo "// CI/CD test change" >> donation-service/src/index.js

# Commit and push to main branch
git add donation-service/
git commit -m "test: trigger CI/CD for donation-service"
git push origin main

# Watch the pipeline
# 1. Go to your GitHub repo → Actions tab
# 2. You should see "Build and Push Docker Images to DockerHub" workflow running
# 3. Click on the running workflow to see details
# 4. Check "detect-changes" job output
# 5. Only donation-service should build (others skipped)
# 6. After completion, check DockerHub for new images
```

#### **Option B: Manual Trigger**
```bash
# No code changes needed
# 1. Go to GitHub repo → Actions tab
# 2. Select "Build and Push Docker Images to DockerHub"
# 3. Click "Run workflow"
# 4. Select branch: main
# 5. Optionally check "Force build all services"
# 6. Click "Run workflow" button
```

#### **Verify on DockerHub**
1. Go to https://hub.docker.com
2. Login with your credentials
3. Check your repositories
4. You should see new images:
   - `{username}/donation-service:latest`
   - `{username}/donation-service:main-{git-sha}`
   - (and other services if they were built)

## 📊 Available Stress Test Scenarios

```bash
# Existing scenarios
node stress-test.js register 100 10      # Registration load test
node stress-test.js login 100 10         # Login load test
node stress-test.js campaigns 500 50     # Campaign queries
node stress-test.js campaign-detail 200 20

# NEW donation scenarios
node stress-test.js donate 100 10                 # Random donations ($5-$105)
node stress-test.js donate-idempotent 50 10       # Test duplicate prevention
```

## 🔧 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs donation-service
docker-compose logs payment-service
docker-compose logs notification-service

# Check for port conflicts
netstat -ano | findstr :6000

# Rebuild from scratch
docker-compose down -v
docker-compose up --build -d
```

### Metrics not appearing
```bash
# Check Prometheus targets
# Open http://localhost/prometheus/targets
# All services should show UP status

# Check metrics endpoint directly
curl http://localhost:6000/metrics
```

### CI/CD failing
```bash
# Check GitHub Actions logs for error messages
# Common issues:
# 1. DOCKERHUB_USERNAME or DOCKERHUB_TOKEN not set
# 2. Token expired or has wrong permissions
# 3. Service directory name mismatch in workflow file
```

### Traces not in Jaeger
```bash
# Check Jaeger is running
docker ps | grep jaeger

# Check OTEL environment variables
docker exec donation_service env | grep OTEL

# Should see:
# OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
# OTEL_SERVICE_NAME=donation-service

# Restart service
docker-compose restart donation-service
```

## 📚 Documentation Files

- `NEW_SERVICES_INTEGRATION.md` - Comprehensive guide (this file's detailed version)
- `TRACING_AND_LOGGING_GUIDE.md` - Complete tracing and logging documentation
- `MONITORING_GUIDE.md` - Prometheus and Grafana setup
- `SETUP_COMPLETE.md` - Quick start guide for entire system

## ✅ Completion Checklist

- [ ] GitHub secrets configured (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
- [ ] npm install run for all three services
- [ ] docker-compose up --build -d completed successfully
- [ ] All containers running (docker ps shows 15+ containers)
- [ ] Donation service health check passes (curl http://localhost:6000/health)
- [ ] Prometheus shows donation-service target as UP
- [ ] Grafana dashboard loads without errors
- [ ] Jaeger shows donation-service traces
- [ ] Kibana shows donation_service logs
- [ ] Stress test runs successfully (node stress-test.js donate 10 2)
- [ ] CI/CD pipeline runs successfully (push to main or manual trigger)
- [ ] DockerHub shows newly pushed images

## 🎉 You're All Set!

Once all checkboxes above are complete, your system has:
- ✅ Full observability for all services (tracing, metrics, logs)
- ✅ Automated CI/CD with selective Docker builds
- ✅ Load testing capabilities for all endpoints
- ✅ Production-ready monitoring and alerting

For detailed information, see `NEW_SERVICES_INTEGRATION.md`.

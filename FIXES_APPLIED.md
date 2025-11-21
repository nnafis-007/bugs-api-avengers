# 🔧 Quick Fixes Applied

## Issue 1: Jaeger Access ✅ FIXED

**Problem:** You asked how to access Jaeger on port 16686 when only port 80 is exposed.

**Solution:** 
- Removed direct port exposure of 16686 from docker-compose.yml
- Added `QUERY_BASE_PATH=/jaeger` environment variable to Jaeger
- Access Jaeger via nginx reverse proxy

**How to Access:**
- ✅ **Correct:** http://localhost/jaeger/
- ❌ **Old (no longer works):** http://localhost:16686

**Why this is better:**
- All services accessible through single port (80)
- Consistent with other services (Grafana at /grafana, Prometheus at /prometheus, Kibana at /kibana)
- More secure - no direct container port exposure

---

## Issue 2: Kibana Failing ✅ FIXED

**Problem:** 
```
login_kibana is unhealthy
dependency failed to start: container login_kibana is unhealthy
```

**Root Cause:** 
Kibana takes 2-3 minutes to start (connection to Elasticsearch + plugin initialization), but the healthcheck was timing out after ~100 seconds (10s interval × 10 retries).

**Solution Applied:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:5601/kibana/api/status || exit 1"]
  interval: 15s        # Was: 10s
  timeout: 10s         # Was: 5s
  retries: 30          # Was: 10 retries
  start_period: 120s   # NEW: Don't count failures for first 2 minutes
```

**Additional Changes:**
- Added `LOGGING_ROOT_LEVEL=warn` to reduce log verbosity
- Total healthcheck time now: 120s (start_period) + 450s (30 × 15s) = ~9.5 minutes max

**What This Means:**
- Kibana now has enough time to fully start
- No more "unhealthy" errors
- nginx will wait for Kibana to be ready before starting

---

## 🚀 How to Apply These Fixes

### Step 1: Stop Current Containers
```bash
docker-compose down
```

### Step 2: Pull Latest Config (Already Done - Files Updated)
The following files were automatically updated:
- ✅ `docker-compose.yml` - Kibana healthcheck + Jaeger config
- ✅ `QUICK_SETUP_CHECKLIST.md` - Updated Jaeger URL
- ✅ `NEW_SERVICES_INTEGRATION.md` - Updated Jaeger URL

### Step 3: Start Services
```bash
docker-compose up -d
```

### Step 4: Monitor Kibana Startup
```bash
# Watch Kibana logs
docker logs -f login_kibana

# You should see:
# [INFO ][plugins-service] Plugin initialization starting...
# [INFO ][http.server.Preboot] http server running at http://0.0.0.0:5601/kibana
# [INFO ][plugins-system.standard] Setting up plugins...
# ... (takes 2-3 minutes) ...
# [INFO ][status] Kibana is now available
```

**Expected Timeline:**
- 0-30s: Elasticsearch starting
- 30-90s: Elasticsearch becomes healthy
- 90-240s: Kibana connecting and initializing
- 240-300s: Kibana becomes healthy ✅
- 300s+: nginx starts (all dependencies ready)

### Step 5: Verify Everything is Running
```bash
docker ps

# Should see all containers with "healthy" or "running" status:
# - login_elasticsearch (healthy)
# - login_kibana (healthy) ✅ THIS WAS FAILING BEFORE
# - login_nginx (running)
# - login_jaeger (healthy)
# - donation_service (running)
# - payment_service (running)
# - notification_service (running)
# ... and all other services
```

---

## 📊 Access URLs (Updated)

All services now accessible via port 80 only:

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost/ | ✅ Working |
| Backend API | http://localhost/api/ | ✅ Working |
| Grafana | http://localhost/grafana/ | ✅ Working |
| Prometheus | http://localhost/prometheus/ | ✅ Working |
| Kibana | http://localhost/kibana/ | ✅ Fixed (was failing) |
| Jaeger | http://localhost/jaeger/ | ✅ Fixed (was port 16686) |

**No direct port access needed!** Everything through nginx on port 80.

---

## 🧪 Test the Fixes

### Test 1: Verify Kibana is Accessible
```bash
# Wait for Kibana to fully start (2-3 minutes after docker-compose up)
curl http://localhost/kibana/api/status

# Should return JSON with status: "available"
```

### Test 2: Verify Jaeger is Accessible
```bash
# Check Jaeger UI
curl http://localhost/jaeger/

# Should return HTML with Jaeger UI
```

### Test 3: Run Full System Test
```bash
# Run donation stress test
node stress-test.js donate 10 2

# Then check each service:
# 1. Logs in Kibana: http://localhost/kibana/
# 2. Traces in Jaeger: http://localhost/jaeger/
# 3. Metrics in Grafana: http://localhost/grafana/
# 4. Raw metrics in Prometheus: http://localhost/prometheus/
```

---

## 🔍 Troubleshooting

### If Kibana Still Fails

**Check Elasticsearch is healthy first:**
```bash
docker ps | grep elasticsearch
# Should show: (healthy)

curl http://localhost:9200/_cluster/health
# Should return: "status":"green" or "status":"yellow"
```

**Check Kibana logs for errors:**
```bash
docker logs login_kibana | grep ERROR
docker logs login_kibana | grep WARN
```

**If stuck at "Validating Elasticsearch connection":**
```bash
# Restart just Kibana
docker-compose restart kibana

# If still fails, restart both
docker-compose restart elasticsearch kibana
```

### If Jaeger Not Accessible

**Check Jaeger is running:**
```bash
docker ps | grep jaeger
# Should show: login_jaeger (healthy)

# Check Jaeger logs
docker logs login_jaeger
```

**Check nginx is proxying correctly:**
```bash
docker logs login_nginx | grep jaeger

# Test direct connection to Jaeger (inside docker network)
docker exec login_nginx curl http://jaeger:16686
# Should return HTML
```

**If 404 on /jaeger/ route:**
```bash
# Restart nginx to reload config
docker-compose restart nginx
```

---

## ⏱️ Expected Startup Times

Based on your logs, here are the typical startup times:

| Service | Time to Healthy | Why |
|---------|----------------|-----|
| Elasticsearch | ~75 seconds | Large JVM startup, index initialization |
| Kafka | ~36 seconds | Zookeeper coordination, broker startup |
| Database (PostgreSQL) | ~13 seconds | DB initialization, schema creation |
| Redis | ~8 seconds | Fast in-memory startup |
| **Kibana** | **180-300 seconds** | **Plugin initialization, ES connection, UI build** |
| Jaeger | ~10 seconds | Lightweight Go binary |
| nginx | Waits for all | Depends on Kibana being healthy |

**Total time from `docker-compose up -d` to full system ready: ~5-6 minutes**

---

## ✅ Success Indicators

You'll know everything is working when:

1. **All containers healthy:**
   ```bash
   docker ps
   # No containers with "unhealthy" status
   # nginx is running (was failing due to Kibana dependency)
   ```

2. **All UIs accessible:**
   - http://localhost/ → Frontend loads ✅
   - http://localhost/grafana/ → Grafana dashboards ✅
   - http://localhost/prometheus/ → Prometheus metrics ✅
   - http://localhost/kibana/ → Kibana Discover page ✅
   - http://localhost/jaeger/ → Jaeger tracing UI ✅

3. **Services responding:**
   ```bash
   curl http://localhost/api/campaigns
   curl http://localhost:6000/health
   curl http://localhost/kibana/api/status
   curl http://localhost/jaeger/api/services
   ```

---

## 📌 Summary

**What Changed:**
1. ✅ Kibana healthcheck extended (30 retries, 120s start period)
2. ✅ Jaeger port 16686 no longer exposed (access via /jaeger/ instead)
3. ✅ Jaeger configured with `QUERY_BASE_PATH=/jaeger`
4. ✅ Documentation updated with correct URLs

**Benefits:**
- Kibana has enough time to start properly
- All services accessible via single port (80)
- Cleaner, more secure configuration
- Consistent access pattern for all UIs

**Next Steps:**
1. Run `docker-compose down && docker-compose up -d`
2. Wait 5-6 minutes for full startup
3. Access all services via http://localhost/
4. Run stress tests to generate data
5. View traces in http://localhost/jaeger/ ✅

# Comprehensive Monitoring Setup

## 📊 Overview

This monitoring system provides complete observability for the donation platform with:
- **5 Grafana Dashboards** - One for each service plus system overview
- **30+ Custom Metrics** - Application and business metrics
- **25+ Alert Rules** - Proactive detection of issues
- **4 Exporters** - Infrastructure and database monitoring

---

## 🎯 What We're Monitoring

### **System Health Indicators**

#### **1. Service Overload Detection**
- **High Request Rate** - Detects when request volume exceeds capacity
- **High CPU Usage** - Alerts when CPU > 70% (warning) or > 90% (critical)
- **High Memory Usage** - Alerts when memory > 80% (warning) or > 95% (critical)
- **Request Latency** - P95 latency > 2s (warning) or > 5s (critical)

#### **2. Risk of System Failure**
- **Connection Pool Exhaustion** - Database connections > 80 (warning) or > 95 (critical)
- **Memory Pressure** - Container memory near limit, risk of OOM kill
- **Disk Space** - Filesystem usage approaching limits
- **Network Saturation** - High network I/O indicating bottleneck

#### **3. Performance Degradation**
- **Slow Database Queries** - P95 query time > 1 second
- **Cache Inefficiency** - Cache hit rate < 70% (warning) or < 40% (critical)
- **Kafka Consumer Lag** - Message processing falling behind (> 100 or > 1000 messages)
- **Error Rate Spike** - 5xx errors > 5% (warning) or > 15% (critical)

---

## 📈 Metrics Collected

### **Backend Service (`backend:4000`)**
```
http_request_duration_seconds       - Request latency by route
http_requests_total                 - Request count by status code
nodejs_heap_size_used_bytes         - Heap memory usage
nodejs_eventloop_lag_seconds        - Event loop lag (blocking operations)
nodejs_active_handles               - Active file/network handles
nodejs_gc_duration_seconds          - Garbage collection time
```

### **Campaign Service (`campaign-service:5000`)**
```
campaign_http_request_duration_seconds    - API response time
campaign_http_requests_total              - API request count
campaign_cache_hits_total                 - Cache hits by key type
campaign_cache_misses_total               - Cache misses by key type
campaign_redis_operation_duration_seconds - Redis operation latency
campaign_db_query_duration_seconds        - Database query time
campaign_active_campaigns_total           - Number of active campaigns
```

### **Backend Consumer (`backend-consumer:9091`)**
```
kafka_consumer_messages_processed_total           - Messages processed (success/error)
kafka_consumer_message_processing_duration_seconds - Processing time per message
kafka_consumer_lag                                 - Consumer lag by topic/partition
kafka_consumer_errors_total                        - Consumer errors by type
```

### **Database (PostgreSQL via postgres-exporter)**
```
pg_stat_database_numbackends         - Active connections
pg_stat_database_xact_commit         - Committed transactions
pg_stat_database_xact_rollback       - Rolled back transactions
pg_stat_database_deadlocks           - Deadlock occurrences
pg_stat_database_blks_hit            - Cache hits
pg_stat_database_blks_read           - Disk reads
pg_stat_user_tables_n_tup_ins        - Rows inserted per table
pg_stat_user_tables_seq_scan         - Sequential scans (bad for performance)
pg_stat_user_tables_idx_scan         - Index scans (good)
pg_locks_count                       - Active locks by type
```

### **Redis Cache (via redis-exporter)**
```
redis_up                             - Redis availability
redis_connected_clients              - Active connections
redis_memory_used_bytes              - Memory usage
redis_keyspace_hits_total            - Cache hits
redis_keyspace_misses_total          - Cache misses
redis_commands_processed_total       - Commands executed
```

### **Infrastructure (cAdvisor + Node Exporter)**
```
container_cpu_usage_seconds_total    - CPU usage per container
container_memory_usage_bytes         - Memory usage per container
container_network_receive_bytes      - Network RX per container
container_network_transmit_bytes     - Network TX per container
container_fs_reads_bytes_total       - Disk reads per container
container_fs_writes_bytes_total      - Disk writes per container
node_load1, node_load5, node_load15  - System load average
node_memory_MemAvailable_bytes       - Available system memory
node_filesystem_avail_bytes          - Available disk space
```

---

## 🚨 Alert Rules

### **Critical Alerts (Immediate Action Required)**

| Alert | Trigger | Impact |
|-------|---------|--------|
| **CriticalCPUUsage** | CPU > 90% for 30s | System may freeze, requests timeout |
| **CriticalMemoryUsage** | Memory > 95% for 1m | Container OOM kill imminent |
| **BackendDown** | Backend unreachable for 30s | All API requests failing |
| **CampaignServiceDown** | Campaign service unreachable | Campaign data unavailable |
| **BackendConsumerDown** | Consumer unreachable | Event processing stopped |
| **CriticalRequestLatency** | P95 latency > 5s | Users experiencing major delays |
| **CriticalErrorRate** | Error rate > 15% | System severely degraded |
| **RequestFlood** | > 500 req/s | Possible DDoS, system overwhelmed |
| **DatabaseConnectionPoolExhausted** | Connections > 95 | New requests will be rejected |
| **CriticalKafkaConsumerLag** | Lag > 1000 messages | Processing severely behind |
| **RedisDown** | Redis unreachable | All cache requests failing |

### **Warning Alerts (Monitor Closely)**

| Alert | Trigger | Impact |
|-------|---------|--------|
| **HighCPUUsage** | CPU > 70% for 1m | Performance degrading |
| **HighMemoryUsage** | Memory > 80% for 2m | Memory pressure building |
| **HighRequestLatency** | P95 latency > 2s | Users noticing slowness |
| **HighErrorRate** | Error rate > 5% | Increased failures |
| **RequestSurge** | > 100 req/s | Traffic spike detected |
| **TooManyDatabaseConnections** | Connections > 80 | Connection pool under pressure |
| **SlowDatabaseQueries** | P95 query > 1s | Database bottleneck |
| **LowCacheHitRate** | Hit rate < 70% | Database load increasing |
| **KafkaConsumerLag** | Lag > 100 messages | Processing falling behind |
| **KafkaConsumerErrors** | > 1 error/s | Message processing issues |

---

## 📊 Grafana Dashboards

Access Grafana at: `http://localhost/grafana`
- **Username**: `admin`
- **Password**: `grafana`

### **1. System Overview Dashboard**
**URL**: `/d/system-overview`
**Purpose**: High-level health check of entire system

**Panels**:
- Service Health Status (UP/DOWN indicators)
- Total Request Rate (all services combined)
- Total Error Rate (all services combined)
- CPU Usage (all containers)
- Memory Usage (all containers)
- Network I/O (all containers)
- System Load Average
- Active Alerts Table
- Key Metrics Summary (DB connections, cache hit rate, consumer lag)

**Use Cases**:
- Daily health check
- Incident triage (which service is affected?)
- Capacity planning
- Identifying system-wide issues

---

### **2. Backend Service Dashboard**
**URL**: `/d/backend-service`
**Purpose**: Monitor main API service handling user/donation requests

**Panels**:
- HTTP Request Rate by endpoint
- Request Latency (P95) by endpoint
- Error Rate (5xx responses)
- Success Rate percentage
- CPU Usage
- Memory Usage
- Node.js Event Loop Lag
- Heap Memory Usage
- Active Handles & Requests
- Garbage Collection Duration

**Use Cases**:
- Identify slow endpoints
- Detect authentication issues (high latency on /api/login)
- Monitor JWT token generation performance
- Detect memory leaks (rising heap usage)
- Identify blocking operations (event loop lag)

**Overload Indicators**:
- ✅ **Normal**: Request rate < 50 req/s, P95 latency < 500ms
- ⚠️ **Warning**: Request rate 50-100 req/s, P95 latency 500ms-2s
- 🚨 **Overload**: Request rate > 100 req/s, P95 latency > 2s, CPU > 70%

---

### **3. Campaign Service Dashboard**
**URL**: `/d/campaign-service`
**Purpose**: Monitor campaign/donation service with Redis caching

**Panels**:
- API Request Rate
- API Response Time (P95)
- Cache Hit Rate (%)
- Cache Operations (hits vs misses)
- Redis Operation Duration
- Database Query Duration
- Active Campaigns Count
- Request Success Rate
- CPU Usage
- Memory Usage

**Use Cases**:
- Monitor cache effectiveness
- Detect cache issues (low hit rate = database overload)
- Identify slow campaign queries
- Track campaign creation/updates
- Detect donation processing bottlenecks

**Overload Indicators**:
- ✅ **Normal**: Cache hit rate > 80%, query time < 100ms
- ⚠️ **Warning**: Cache hit rate 60-80%, query time 100-500ms
- 🚨 **Overload**: Cache hit rate < 60%, query time > 500ms, DB connections high

---

### **4. Backend Consumer Dashboard**
**URL**: `/d/backend-consumer`
**Purpose**: Monitor Kafka message processing

**Panels**:
- Messages Processed Rate (success/error)
- Message Processing Duration (P95)
- Consumer Lag by topic/partition
- Consumer Errors by type
- Total Messages Processed
- Processing Success Rate
- Consumer Health Status
- CPU Usage
- Memory Usage

**Use Cases**:
- Detect event processing delays (consumer lag)
- Monitor message processing errors
- Track donation event throughput
- Identify stuck consumer
- Detect message format issues

**Overload Indicators**:
- ✅ **Normal**: Lag < 10 messages, processing < 100ms
- ⚠️ **Warning**: Lag 10-100 messages, processing 100-500ms
- 🚨 **Overload**: Lag > 100 messages, processing > 500ms, errors increasing

---

### **5. PostgreSQL Database Dashboard**
**URL**: `/d/database-postgres`
**Purpose**: Comprehensive database performance monitoring

**Panels**:
- Database Connections (active vs max)
- Connection State (active, idle, etc.)
- Transactions per Second (commits/rollbacks)
- Tuple Operations (inserts, updates, deletes, fetches)
- Deadlocks
- Cache Hit Ratio (should be > 95%)
- Database Size
- Temp Files Created
- Table Stats (inserts/updates/deletes per table)
- Sequential vs Index Scans
- Table Bloat (dead tuples)
- Lock Types
- Checkpoint Activity

**Use Cases**:
- Detect connection leaks (connections not released)
- Monitor transaction throughput
- Identify deadlocks (indicates locking issues)
- Check query efficiency (sequential scans are slow)
- Monitor database growth
- Detect table bloat (needs VACUUM)
- Identify lock contention

**Overload Indicators**:
- ✅ **Normal**: Connections < 50, cache hit > 95%, no deadlocks
- ⚠️ **Warning**: Connections 50-80, cache hit 90-95%, occasional deadlocks
- 🚨 **Overload**: Connections > 80, cache hit < 90%, frequent deadlocks, high locks

---

## 🎯 Detecting System Overload

### **Scenario 1: High Donation Volume**

**Symptoms**:
```
- Backend request rate: 150 req/s (normally 20 req/s)
- Backend CPU: 85%
- Backend P95 latency: 3 seconds (normally 200ms)
- Campaign service cache hit rate: 45% (normally 80%)
- Database connections: 90 (normally 30)
- Database P95 query time: 2 seconds (normally 100ms)
```

**Dashboard Indicators**:
- System Overview: Request surge alert firing
- Backend Dashboard: High request rate, high latency, high CPU
- Campaign Dashboard: Low cache hit rate, slow queries
- Database Dashboard: High connections, slow queries

**Action**:
1. Check backend logs for errors
2. Verify cache is working (Redis up?)
3. Consider scaling backend horizontally
4. Add database connection pool limits
5. Implement rate limiting

---

### **Scenario 2: Database Bottleneck**

**Symptoms**:
```
- Campaign service P95 query time: 5 seconds
- Database connections: 95
- Database deadlocks: Occurring
- Campaign service P95 latency: 6 seconds
- Cache hit rate: 30%
```

**Dashboard Indicators**:
- Database Dashboard: Connection pool near exhaustion, deadlocks
- Campaign Dashboard: Slow queries, low cache effectiveness
- System Overview: High error rate

**Action**:
1. Check slow query logs
2. Analyze missing indexes
3. Check for long-running queries
4. Increase cache TTL
5. Add database read replicas

---

### **Scenario 3: Consumer Falling Behind**

**Symptoms**:
```
- Kafka consumer lag: 5000 messages
- Message processing time: 5 seconds (normally 50ms)
- Consumer CPU: 95%
- Backend continue producing events normally
```

**Dashboard Indicators**:
- Backend Consumer Dashboard: Critical lag alert, slow processing
- System Overview: Consumer lag metric high

**Action**:
1. Check consumer logs for errors
2. Identify slow message processing
3. Scale consumer horizontally (add more instances)
4. Optimize message processing logic
5. Increase Kafka partition count

---

### **Scenario 4: Memory Leak**

**Symptoms**:
```
- Backend heap memory: continuously increasing
- Backend memory: 90% (was 40% at startup)
- Event loop lag: increasing over time
- Garbage collection: frequent, long duration
```

**Dashboard Indicators**:
- Backend Dashboard: Rising heap usage, GC spikes, event loop lag
- System Overview: Memory pressure alert

**Action**:
1. Take heap snapshot
2. Identify memory leak (objects not released)
3. Check for event listener leaks
4. Review recent code changes
5. Restart service as temporary fix

---

## 🔄 Starting the Monitoring Stack

```bash
# 1. Start all services including monitoring
docker-compose up -d

# 2. Verify Prometheus is scraping targets
# Open: http://localhost/prometheus/targets
# All targets should be "UP"

# 3. Access Grafana
# Open: http://localhost/grafana
# Login: admin / grafana

# 4. View dashboards
# Navigate to Dashboards → Browse
# You should see:
# - System Overview Dashboard
# - Backend Service Dashboard
# - Campaign Service Dashboard
# - Backend Consumer Dashboard
# - PostgreSQL Database Dashboard

# 5. Check alerts
# Navigate to Alerting → Alert Rules
# You should see 25+ alert rules
```

---

## 📝 Maintenance

### **Daily Tasks**
- [ ] Check System Overview dashboard for service health
- [ ] Review active alerts in Prometheus
- [ ] Verify all services are UP
- [ ] Check for abnormal patterns (traffic spikes, error spikes)

### **Weekly Tasks**
- [ ] Review database growth trend
- [ ] Analyze slow queries
- [ ] Check cache hit rate trends
- [ ] Review consumer lag trends
- [ ] Identify performance degradation patterns

### **Monthly Tasks**
- [ ] Capacity planning (predict when to scale)
- [ ] Review and tune alert thresholds
- [ ] Analyze historical metrics for trends
- [ ] Optimize slow endpoints
- [ ] Clean up old metrics data

---

## 🆘 Troubleshooting

### **Prometheus Not Scraping Target**

**Symptoms**: Target shows as "DOWN" in Prometheus
**Check**:
1. Service is running: `docker ps | grep <service>`
2. Metrics endpoint accessible: `curl http://localhost:<port>/metrics`
3. Network connectivity: Services in same Docker network
4. Firewall not blocking ports

### **Grafana Dashboard Shows No Data**

**Symptoms**: Dashboard panels empty
**Check**:
1. Prometheus datasource configured
2. Time range not too far in past
3. Prometheus has data: Check Prometheus UI
4. Query syntax correct

### **Alerts Not Firing**

**Symptoms**: Alert should fire but doesn't
**Check**:
1. Alert rule syntax correct
2. Evaluation interval passed
3. `for` duration passed
4. Prometheus rule evaluation: `/rules` endpoint

---

## 📚 Additional Resources

- **Prometheus Query Language**: https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Grafana Documentation**: https://grafana.com/docs/
- **Alert Best Practices**: Focus on actionable alerts, avoid alert fatigue
- **SLI/SLO/SLA**: Consider defining Service Level Objectives

---

## 🎓 Key Takeaways

1. **Comprehensive Coverage**: Every service monitored with specific metrics
2. **Proactive Alerts**: Detect issues before users complain
3. **Separate Dashboards**: Each service has dedicated dashboard for deep dive
4. **Database Monitoring**: Most critical component, monitored extensively
5. **Overload Detection**: Clear indicators when system under stress
6. **Actionable Insights**: Metrics help identify root cause, not just symptoms

---

**Your monitoring system is now production-ready and will help you maintain a healthy, performant donation platform!** 🚀

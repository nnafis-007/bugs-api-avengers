// Initialize OpenTelemetry tracing FIRST (before any other imports)
require('./tracing');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const client = require('prom-client');
const { trace, context } = require('@opentelemetry/api');
const { createClient } = require('redis');
const { pool, initDb } = require('./db');

const app = express();

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics for campaign service
const httpRequestDuration = new client.Histogram({
  name: 'campaign_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const httpRequestCounter = new client.Counter({
  name: 'campaign_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const cacheHitCounter = new client.Counter({
  name: 'campaign_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key_type'],
  registers: [register]
});

const cacheMissCounter = new client.Counter({
  name: 'campaign_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key_type'],
  registers: [register]
});

const redisOperationDuration = new client.Histogram({
  name: 'campaign_redis_operation_duration_seconds',
  help: 'Duration of Redis operations',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const dbQueryDuration = new client.Histogram({
  name: 'campaign_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const activeCampaignsGauge = new client.Gauge({
  name: 'campaign_active_campaigns_total',
  help: 'Total number of active campaigns',
  registers: [register]
});

// Metrics endpoint FIRST
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use(cors());
app.use(express.json());

// Middleware to track metrics
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
    httpRequestCounter.inc({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

const PORT = process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = 600; // 5 minutes

// Initialize Redis client
const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Connect Redis
(async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Redis connection established');
  } catch (err) {
    console.error('Redis connection failed:', err);
  }
})();

// Initialize DB with retry
(async function ensureDb() {
  const maxAttempts = 30;
  const delay = ms => new Promise(r => setTimeout(r, ms));
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initDb();
      console.log('Campaigns DB initialized and seeded');
      break;
    } catch (err) {
      console.error(`Campaigns DB init failed (attempt ${attempt}/${maxAttempts}):`, err.message || err);
      if (attempt === maxAttempts) {
        console.error('Max attempts reached; continuing without guaranteed DB init.');
      } else {
        await delay(2000);
      }
    }
  }
})();

// Get all campaigns with caching
app.get('/api/campaigns', async (req, res) => {
  try {
    const cacheKey = 'campaigns:all';
    
    // Try to get from cache
    const redisStart = Date.now();
    const cached = await redisClient.get(cacheKey);
    redisOperationDuration.observe({ operation: 'get' }, (Date.now() - redisStart) / 1000);
    
    if (cached) {
      console.log('Cache hit for all campaigns');
      cacheHitCounter.inc({ cache_key_type: 'all_campaigns' });
      return res.json(JSON.parse(cached));
    }
    
    // Cache miss - fetch from database
    console.log('Cache miss for all campaigns - fetching from DB');
    cacheMissCounter.inc({ cache_key_type: 'all_campaigns' });
    
    const dbStart = Date.now();
    const result = await pool.query(
      'SELECT id, name, total_amount_raised, created_at, updated_at FROM campaigns ORDER BY created_at DESC'
    );
    dbQueryDuration.observe({ query_type: 'select_all_campaigns' }, (Date.now() - dbStart) / 1000);
    
    const response = { campaigns: result.rows };
    
    // Update gauge with campaign count
    activeCampaignsGauge.set(result.rows.length);
    
    // Store in cache
    const redisSetStart = Date.now();
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    redisOperationDuration.observe({ operation: 'setex' }, (Date.now() - redisSetStart) / 1000);
    
    res.json(response);
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get single campaign by ID with caching
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `campaigns:${id}`;
    
    // Try to get from cache
    const redisStart = Date.now();
    const cached = await redisClient.get(cacheKey);
    redisOperationDuration.observe({ operation: 'get' }, (Date.now() - redisStart) / 1000);
    
    if (cached) {
      console.log(`Cache hit for campaign ${id}`);
      cacheHitCounter.inc({ cache_key_type: 'single_campaign' });
      return res.json(JSON.parse(cached));
    }
    
    // Cache miss - fetch from database
    console.log(`Cache miss for campaign ${id} - fetching from DB`);
    cacheMissCounter.inc({ cache_key_type: 'single_campaign' });
    
    const dbStart = Date.now();
    const result = await pool.query(
      'SELECT id, name, total_amount_raised, created_at, updated_at FROM campaigns WHERE id = $1',
      [id]
    );
    dbQueryDuration.observe({ query_type: 'select_campaign_by_id' }, (Date.now() - dbStart) / 1000);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const response = { campaign: result.rows[0] };
    
    // Store in cache
    const redisSetStart = Date.now();
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    redisOperationDuration.observe({ operation: 'setex' }, (Date.now() - redisSetStart) / 1000);
    
    res.json(response);
  } catch (err) {
    console.error('Error fetching campaign:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'campaign-service' });
});

app.listen(PORT, () => console.log(`Campaign service listening on ${PORT}`));

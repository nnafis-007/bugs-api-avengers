// Initialize OpenTelemetry tracing first (before any other requires)
require('./tracing');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { publishDonation } = require('./kafka-producer');
const promClient = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics for donation service
const donationsTotal = new promClient.Counter({
  name: 'donations_total',
  help: 'Total number of donations received',
  labelNames: ['status', 'campaign_id'],
  registers: [register]
});

const donationAmount = new promClient.Histogram({
  name: 'donation_amount_usd',
  help: 'Donation amounts in USD',
  labelNames: ['campaign_id'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register]
});

const idempotencyCacheSize = new promClient.Gauge({
  name: 'idempotency_cache_size',
  help: 'Current number of entries in idempotency cache',
  registers: [register]
});

const idempotencyHits = new promClient.Counter({
  name: 'idempotency_hits_total',
  help: 'Total number of duplicate requests prevented by idempotency',
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'donation_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode.toString()).observe(duration);
  });
  next();
});

const PORT = process.env.PORT || 6000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// In-memory idempotency cache (in production, use Redis with TTL)
// Key: idempotencyKey, Value: { response, timestamp }
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Clean up old idempotency keys periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// JWT authentication middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ 
      error: 'Missing authorization header',
      message: 'Please provide a Bearer token in the Authorization header'
    });
  }
  
  const [type, token] = auth.split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ 
      error: 'Invalid authorization format',
      message: 'Use format: Authorization: Bearer <token>'
    });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again or refresh your token.'
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is malformed or invalid'
      });
    }
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: err.message
    });
  }
}

// POST /donate endpoint - Authenticated with Idempotency Support
app.post('/api/donate', authMiddleware, async (req, res) => {
  try {
    const { campaignId, amount } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];
    
    // Validate idempotency key
    if (!idempotencyKey) {
      return res.status(400).json({ 
        error: 'Idempotency key required',
        message: 'Please provide an Idempotency-Key header to prevent duplicate donations'
      });
    }
    
    // Check if this request was already processed (idempotent replay)
    const cachedResponse = idempotencyCache.get(idempotencyKey);
    if (cachedResponse) {
      console.log(`🔁 Idempotent request detected for key: ${idempotencyKey.substring(0, 20)}...`);
      console.log(`   Returning cached response for user: ${req.user.email}`);
      idempotencyHits.inc();
      return res.status(200).json({
        ...cachedResponse.response,
        replayed: true,
        message: 'Donation already processed (duplicate request prevented)'
      });
    }
    
    // Validate input
    if (!campaignId) {
      return res.status(400).json({ 
        error: 'Campaign ID is required',
        message: 'Please provide a campaignId in the request body'
      });
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        message: 'Donation amount must be greater than 0'
      });
    }
    
    // Create donation data with idempotency key included
    const donationData = {
      donationId: `DON-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      idempotencyKey: idempotencyKey,
      campaignId: parseInt(campaignId),
      userId: req.user.userId,
      userEmail: req.user.email,
      amount: parseFloat(amount),
      currency: 'USD',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    console.log(`📝 Processing NEW donation from ${req.user.email} for campaign ${campaignId}: $${amount}`);
    console.log(`   Idempotency Key: ${idempotencyKey.substring(0, 20)}...`);
    
    // Record metrics
    donationsTotal.labels('pending', campaignId.toString()).inc();
    donationAmount.labels(campaignId.toString()).observe(parseFloat(amount));
    
    // Publish donation event to Kafka
    await publishDonation(donationData);
    
    // Prepare success response
    const successResponse = {
      success: true,
      message: 'Donation received successfully',
      donation: {
        donationId: donationData.donationId,
        campaignId: donationData.campaignId,
        amount: donationData.amount,
        currency: donationData.currency,
        timestamp: donationData.timestamp
      }
    };
    
    // Cache the response with idempotency key
    idempotencyCache.set(idempotencyKey, {
      response: successResponse,
      timestamp: Date.now()
    });
    
    // Update cache size metric
    idempotencyCacheSize.set(idempotencyCache.size);
    
    console.log(`✅ Donation processed and cached with idempotency key`);
    console.log(`   Cache size: ${idempotencyCache.size} entries`);

    // simulating processing of donation with 2 second delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return success response
    return res.status(201).json(successResponse);
    
  } catch (error) {
    console.error('Error processing donation:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process donation. Please try again later.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'donation-service' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.listen(PORT, () => {
  console.log(`Donation service listening on port ${PORT}`);
  console.log(`💰 Ready to accept donations at POST /api/donate`);
  console.log(`📊 Metrics available at GET /metrics`);
});

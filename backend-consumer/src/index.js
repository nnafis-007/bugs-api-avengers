// Initialize OpenTelemetry tracing FIRST (before any other imports)
require('./tracing');

const { Kafka } = require('kafkajs');
const express = require('express');
const client = require('prom-client');
const { trace, context } = require('@opentelemetry/api');

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics for Kafka consumer
const messagesProcessedCounter = new client.Counter({
  name: 'kafka_consumer_messages_processed_total',
  help: 'Total number of Kafka messages processed',
  labelNames: ['topic', 'status'],
  registers: [register]
});

const messageProcessingDuration = new client.Histogram({
  name: 'kafka_consumer_message_processing_duration_seconds',
  help: 'Time taken to process a message',
  labelNames: ['topic'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register]
});

const consumerLagGauge = new client.Gauge({
  name: 'kafka_consumer_lag',
  help: 'Consumer lag in messages',
  labelNames: ['topic', 'partition'],
  registers: [register]
});

const consumerErrorCounter = new client.Counter({
  name: 'kafka_consumer_errors_total',
  help: 'Total number of consumer errors',
  labelNames: ['topic', 'error_type'],
  registers: [register]
});

// Create Express app for metrics endpoint
const app = express();
const METRICS_PORT = process.env.METRICS_PORT || 9091;

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend-consumer' });
});

app.listen(METRICS_PORT, () => {
  console.log(`Metrics server listening on port ${METRICS_PORT}`);
});

// Environment variables are provided via docker-compose

const kafka = new Kafka({
  clientId: 'login-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: 'login-consumer-group' });

async function startConsumer() {
  const maxRetries = 30;
  const retryDelay = 2000;
  
  try {
    // Connect consumer
    await consumer.connect();
    console.log('Kafka consumer connected');

    // Retry subscription until topic is available
    let subscribed = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await consumer.subscribe({ topic: 'Login', fromBeginning: true });
        console.log('Subscribed to Login topic');
        subscribed = true;
        break;
      } catch (error) {
        console.log(`Waiting for Login topic to be created... (attempt ${attempt}/${maxRetries})`);
        if (attempt === maxRetries) {
          throw new Error('Topic not available after maximum retries');
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!subscribed) {
      throw new Error('Failed to subscribe to Login topic');
    }

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const start = Date.now();
        try {
          const userData = JSON.parse(message.value.toString());
          
          // Log the registration event
          console.log('========================================');
          console.log('🎉 New User Registration Event Received!');
          console.log('========================================');
          console.log('Username:', userData.username);
          console.log('Email:', userData.email);
          console.log('Timestamp:', userData.timestamp);
          console.log('Topic:', topic);
          console.log('Partition:', partition);
          console.log('========================================\n');
          
          // Record successful processing
          const duration = (Date.now() - start) / 1000;
          messageProcessingDuration.observe({ topic }, duration);
          messagesProcessedCounter.inc({ topic, status: 'success' });
          
        } catch (error) {
          console.error('Error processing message:', error);
          consumerErrorCounter.inc({ topic, error_type: error.name || 'unknown' });
          messagesProcessedCounter.inc({ topic, status: 'error' });
        }
      },
    });

  } catch (error) {
    console.error('Error starting consumer:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
  process.on(type, async (error) => {
    try {
      console.log(`Process ${type}: ${error}`);
      await consumer.disconnect();
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.forEach(type => {
  process.once(type, async () => {
    try {
      console.log(`\nReceived ${type}, disconnecting consumer...`);
      await consumer.disconnect();
    } finally {
      process.exit(0);
    }
  });
});

// Start the consumer
startConsumer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

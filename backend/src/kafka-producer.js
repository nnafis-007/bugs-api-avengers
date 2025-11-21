const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'login-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer();

let isConnected = false;

async function connectProducer() {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('Kafka producer connected');
  }
}

async function publishUserRegistration(userData, correlationId = null) {
  try {
    await connectProducer();
    
    const message = {
      username: userData.email.split('@')[0], // Extract username from email
      email: userData.email,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || `kafka-${Date.now()}`
    };

    await producer.send({
      topic: 'Login',
      messages: [
        {
          key: userData.email,
          value: JSON.stringify(message),
          headers: {
            'correlation-id': correlationId || '',
            'source-service': 'backend'
          }
        },
      ],
    });

    console.log(`[${correlationId}] User registration event published to Kafka:`, message);
  } catch (error) {
    console.error(`[${correlationId}] Failed to publish to Kafka:`, error);
    // Don't throw error - registration should succeed even if Kafka fails
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (isConnected) {
    await producer.disconnect();
    console.log('Kafka producer disconnected');
  }
  process.exit(0);
});

module.exports = { publishUserRegistration };

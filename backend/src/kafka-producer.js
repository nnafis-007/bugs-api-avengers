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
const admin = kafka.admin();

let isConnected = false;
let topicEnsured = false;

async function ensureTopicExists() {
  if (topicEnsured) return;
  
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    
    if (!existingTopics.includes('Login')) {
      console.log('📝 Creating Login topic...');
      await admin.createTopics({
        topics: [{ topic: 'Login', numPartitions: 3, replicationFactor: 1 }],
        waitForLeaders: true
      });
      console.log('✅ Login topic created');
    }
    
    await admin.disconnect();
    topicEnsured = true;
  } catch (error) {
    console.error('❌ Error ensuring Login topic exists:', error.message);
    await admin.disconnect().catch(() => {});
    // Don't throw - let the producer retry
  }
}

async function connectProducer() {
  if (!isConnected) {
    await ensureTopicExists();
    await producer.connect();
    isConnected = true;
    console.log('Kafka producer connected');
  }
}

async function publishUserRegistration(userData, correlationId = null) {
  try {
    await connectProducer();
    
    const message = {
      id: userData.id,
      username: userData.username,
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

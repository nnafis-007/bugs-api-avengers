const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure the OTLP exporter to send traces to Jaeger
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces',
});

// Initialize the OpenTelemetry SDK with auto-instrumentation
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'notification-service',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Automatically instrument KafkaJS
      '@opentelemetry/instrumentation-kafkajs': {},
    }),
  ],
});

// Start the SDK and handle shutdown gracefully
sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

console.log('OpenTelemetry tracing initialized for notification-service');

module.exports = sdk;

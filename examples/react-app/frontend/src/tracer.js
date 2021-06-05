const ZIPKIN_TRACE_URL = process.env.ZIPKIN_TRACE_URL;
if (ZIPKIN_TRACE_URL) {
  const { NodeTracerProvider } = require('@opentelemetry/node');
  const { registerInstrumentations } = require('@opentelemetry/instrumentation');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
  const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
  const { SimpleSpanProcessor } = require("@opentelemetry/tracing");
  const { B3Propagator } = require('@opentelemetry/propagator-b3');
  const { Resource } = require('@opentelemetry/resources');
  const { ResourceAttributes } = require('@opentelemetry/semantic-conventions');

  const resource = new Resource({
    [ResourceAttributes.SERVICE_NAME]: 'react-app'
  })
  const provider = new NodeTracerProvider({ resource });

  const options = {
    url: ZIPKIN_TRACE_URL,
  }
  const exporter = new ZipkinExporter(options);
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  provider.register({
    propagator: new B3Propagator(),
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  console.log("tracing initialized");
}

const kafka = require('kafka-node');
const client = new kafka.KafkaClient({ kafkaHost: process.env.ENVIRONMENT === 'local' ? process.env.INTERNAL_KAFKA_ADDR : process.env.EXTERNAL_KAFKA_ADDR });
const Consumer = kafka.Consumer;

const consumer = new Consumer(
  client,
  [
    {
      topic: process.env.TOPIC,
      partition: 0
    }
  ],
  {
    autoCommit: false
  }
);

consumer.on('message', (message) => {
  console.log(message);
});

consumer.on('error', (err) => {
  console.log(err);
});

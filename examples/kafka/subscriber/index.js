const kafka = require('kafka-node');

const client = new kafka.KafkaClient({
  kafkaHost: process.env.KAFKA_ADDR,
});

client.on('ready', () => {
  const consumer = new kafka.Consumer(client, [
    {
      topic: process.env.TOPIC,
      partition: 0,
    }
  ], { autoCommit: false });

  consumer.on('message', message => {
    console.log(message);
  });

  consumer.on('error', err => {
    console.error(err);
  });
});

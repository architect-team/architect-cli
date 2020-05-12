
const kafka = require('kafka-node');
const client = new kafka.KafkaClient({ kafkaHost: process.env.KAFKA_ADDR });
const Producer = kafka.Producer;
const Consumer = kafka.Consumer;
const producer = new Producer(client);

producer.on('ready', () => {
  setInterval(() => {
    const payloads = [
      { topic: process.env.PRODUCE_TOPIC, messages: [`${process.env.PRODUCE_TOPIC}_message_${Date.now()}`] }
    ];

    producer.send(payloads, (err, data) => {
      if (err) { console.log(err); }
      console.log(data);
    });
  }, 5000);
});

producer.on('error', (err) => {
  console.log(err);
});

setTimeout(() => {
  const consumer = new Consumer(
    client,
    [
      { topic: process.env.CONSUME_TOPIC, partition: 0 }
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
}, 15000);

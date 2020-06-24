const kafka = require('kafka-node');

const client = new kafka.KafkaClient({
  kafkaHost: process.env.KAFKA_ADDR,
});

setTimeout(() => {
  console.log('Creating topics');
  client.createTopics([
    {
      topic: process.env.TOPIC,
      partitions: 1,
      replicationFactor: 1,
    }
  ], err => {
    if (err) {
      throw err;
    }

    console.log('Creating producer');
    const producer = new kafka.Producer(client);

    producer.on('ready', () => {
      console.log('Starting interval');
      setInterval(() => {
        console.log('Publishing message');
        producer.send([{
          topic: process.env.TOPIC,
          messages: [
            `message-${Date.now()}`,
          ],
        }], (err, data) => {
          if (err) {
            console.error(err);
          } else {
            console.log(data);
          }
        });
      }, 5000);
    });

    producer.on('error', err => {
      console.error(err);
    });
  });
}, 10000);

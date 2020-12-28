const kafka = require('kafka-node');
const client = new kafka.KafkaClient({ kafkaHost: process.env.ENVIRONMENT === 'local' ? process.env.INTERNAL_KAFKA_ADDR : process.env.EXTERNAL_KAFKA_ADDR });
const Admin = kafka.Admin;
const child_process = require('child_process');

const admin = new Admin(client)
const interval_id = setInterval(() => {
  admin.listTopics((err, res) => {
    if (res[1].metadata.architect) {
      console.log('Kafka topic created');
      clearInterval(interval_id);
      child_process.execSync('npm start', { stdio: 'inherit' });
    } else {
      console.log('Waiting for Kafka topic to be created');
    }
  });
}, 1000);

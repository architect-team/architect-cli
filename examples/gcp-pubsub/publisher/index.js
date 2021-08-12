const { PubSub } = require('@google-cloud/pubsub');

const start = async (gcp_project_id, gcp_pubsub_endpoint, pubsub_topic) => {
  const pubsub = new PubSub({
    projectId: gcp_project_id,
    apiEndpoint: gcp_pubsub_endpoint,
  });

  const topic_unchecked = pubsub.topic(pubsub_topic);
  console.log(topic_unchecked);
  const [topic] = await topic_unchecked.get({ autoCreate: true });

  let count = 0;
  setInterval(async () => {
    await topic.publish(Buffer.from(`${count}s`));
    count++;
  }, 1000);
};

start(process.env.GCP_PROJECT_ID, process.env.PUBSUB_ENDPOINT, process.env.PUBSUB_TOPIC);
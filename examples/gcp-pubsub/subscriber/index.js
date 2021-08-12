const { PubSub } = require('@google-cloud/pubsub');

const start = async (project_id, pubsub_endpoint, topic_name, subscription_name) => {
  const pubsub = new PubSub({
    projectId: project_id,
    apiEndpoint: pubsub_endpoint,
  });

  const topic = pubsub.topic(topic_name);
  const subscription_unchecked = topic.subscription(subscription_name);
  const [subscription] = await subscription_unchecked.get({ autoCreate: true });

  subscription.on('message', message => {
    console.log(message.data.toString());
  });

  subscription.on('error', error => {
    console.error(error);
    process.exit(1);
  });
};

start(
  process.env.GCP_PROJECT_ID,
  process.env.PUBSUB_ENDPOINT,
  process.env.PUBSUB_TOPIC,
  process.env.PUBSUB_SUBSCRIPTION,
);
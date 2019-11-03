export default abstract class SubscriptionOptions {
  event_name: string;

  constructor(event_name: string) {
    this.event_name = event_name;
  }
}

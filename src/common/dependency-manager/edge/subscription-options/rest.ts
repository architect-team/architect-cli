import SubscriptionOptions from '.';

export default class RestSubscriptionOptions extends SubscriptionOptions {
  uri: string;
  headers?: object;

  constructor(event_name: string, uri: string, headers?: object) {
    super(event_name);
    this.uri = uri;
    this.headers = headers;
  }
}

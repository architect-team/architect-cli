export interface SubscriptionEvent {
  uri: string;
  headers?: { [key: string]: string };
}

export interface SubscriptionService {
  [event_name: string]: SubscriptionEvent;
}

export default interface ServiceSubscriptions {
  [service_name: string]: SubscriptionService;
}

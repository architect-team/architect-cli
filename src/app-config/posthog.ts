import { PostHog, PostHogOptions } from 'posthog-node';

type PostHogCliOptions = PostHogOptions & {
  analyticsId: string;
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class PostHogCli extends PostHog {
  constructor(apiKey: string, private options: PostHogCliOptions) {
    super(apiKey, options);
  }

  capture(message: { event: string; properties?: Record<string | number, any>; }): void {
    // We override reInit so the distinctId isn't used
    return super.capture({ distinctId: '<unused>', ...message });
  }

  // Override reInit to not set distinct_id every call
  private reInit(distinctId: string): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Set the anonymous_id so we are consistent across cli calls
    this._sharedClient.setPersistedProperty('anonymous_id', this.options.analyticsId);
  }
}

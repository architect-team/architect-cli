import { PostHog, PostHogOptions } from 'posthog-node';

type PostHogCliOptions = PostHogOptions & {
  analyticsId: string;
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class PostHogCli extends PostHog {
  constructor(apiKey: string, private options: PostHogCliOptions) {
    super(apiKey, options);
    this.setPersistedProperty('anonymous_id' as any, this.options.analyticsId);
  }

  capture(message: { event: string; properties?: Record<string | number, any>; }): void {
    return super.capture({ distinctId: this.options.analyticsId, ...message });
  }
}

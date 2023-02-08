import { PostHog } from 'posthog-node';
// eslint-disable-next-line node/no-missing-import
import type { PosthogCoreOptions } from 'posthog-node/lib/posthog-core/src/types';
import { EventMessageV1 } from 'posthog-node/src/types';

type PostHogCliOptions = PosthogCoreOptions & {
  analyticsId: string;
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class PostHogCli extends PostHog {
  constructor(apiKey: string, private options: PostHogCliOptions) {
    super(apiKey, options);
  }

  capture(message: Omit<EventMessageV1, 'distinctId'>): void {
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

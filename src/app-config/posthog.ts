import fs from 'fs-extra';
import { PostHog, PostHogOptions } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';

type PostHogCliOptions = Omit<PostHogOptions, 'persistence'> & ({
  persistence: 'memory'
} | {
  persistence: 'file';
  propertiesFile: string;
} | Record<string, never>);

export class PostHogCli extends PostHog {
  private _properties: Record<string, any | undefined>;

  constructor(apiKey: string, private _options: PostHogCliOptions) {
    super(apiKey, {
      ..._options,
      persistence: 'memory',
    });

    this._properties = {};
    if (this._options.persistence === 'file' && fs.existsSync(this._options.propertiesFile)) {
      this._properties = fs.readJSONSync(this._options.propertiesFile);
    }

    if (!this._properties.anonymous_id) {
      this.setPersistedProperty('anonymous_id', uuidv4());
    }
  }

  /**
   * @override
   */
  getPersistedProperty(key: string): any | undefined {
    if (this._options.persistence === 'file') {
      return this._properties[key];
    } else {
      return super.getPersistedProperty(key as any);
    }
  }

  /**
   * @override
   */
  setPersistedProperty(key: string, value: any | null): void {
    super.setPersistedProperty(key as any, value);
    this._properties[key] = value;

    if (this._options.persistence === 'file') {
      fs.ensureFileSync(this._options.propertiesFile);
      fs.writeJSONSync(this._options.propertiesFile, this._properties);
    }
  }

  capture(message: { event: string; properties?: Record<string | number, any>; }): void {
    return super.capture({ distinctId: this.getPersistedProperty('anonymous_id'), ...message });
  }
}

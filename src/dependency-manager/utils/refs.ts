import crypto from 'crypto';
import { ServiceNode } from '../graph/node/service';
import { TaskNode } from '../graph/node/task';

export class Refs {
  private static HASH_LENGTH = 8;
  public static DEFAULT_MAX_LENGTH = 63;

  public static safeRef(ref: string, max_length?: number): string;
  // eslint-disable-next-line no-dupe-class-members
  public static safeRef(ref: string, seed?: string, max_length?: number): string;
  // eslint-disable-next-line no-dupe-class-members
  public static safeRef(ref: string, seed?: string | number, max_length: number = Refs.DEFAULT_MAX_LENGTH): string {
    if (typeof seed == 'number') {
      max_length = seed;
    }
    if (typeof seed == 'number' || !seed) {
      seed = ref;
    }

    if (max_length < Refs.HASH_LENGTH) {
      throw new Error('Max length cannot be less than hash length');
    }

    const sanitized_ref = ref.replace(/[^a-zA-Z0-9-]/g, '-');
    const truncated_ref = sanitized_ref.substring(0, (max_length - 1) - Refs.HASH_LENGTH);
    const hash = Refs.toDigest(seed).substring(0, Refs.HASH_LENGTH);

    return `${truncated_ref}-${hash}`;
  }

  public static trimSafeRef(ref: string, max_length = Refs.DEFAULT_MAX_LENGTH, prefix = '', suffix = ''): string {
    const split = ref.split('-');
    const hash = split.pop();
    if (!hash || hash.length !== Refs.HASH_LENGTH) { throw new Error(`Not a valid ref: ${ref}`); }

    const target_length = max_length - (hash.length + 1 + suffix.length);
    if (target_length < 0) {
      throw new Error(`Cannot trim ref to length: ${max_length}`);
    }

    const trimmed_name = `${prefix}${split.join('-')}`.substring(0, target_length);
    return `${trimmed_name}${suffix}-${hash}`;
  }

  /**
   * This is not a standard base64 md5 hash as we lowercase and replace punctuation
   * This method should not be used for anything beyond conveniently adding entropy to the safeRef.
   * @param uri
   */
  private static toDigest(uri: string): string {
    return crypto.createHash('md5').update(uri)
      .digest("base64") // base64 adds entropy in a more compact string
      .toLowerCase() // we need to makes everything lower which unfortunately removes some entropy
      .replace(/[\\/+=]/g, ''); // we also remove occurances of slash, plus, and equals to make url-safe
  }

  public static getArchitectRef(node: ServiceNode | TaskNode) {
    let component_name;
    let tenant_name;
    if (node.config.metadata.instance_id) {
      [component_name, tenant_name] = node.config.metadata.instance_id.split('@');
    }
    const node_type = node instanceof ServiceNode ? 'services' : 'tasks';
    const tenant = tenant_name ? `@${tenant_name}` : '';
    return `architect.ref=${component_name}.${node_type}.${node.config.name}${tenant}`;
  }
}

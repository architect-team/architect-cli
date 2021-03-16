import crypto from 'crypto';

export class Refs {
  private static HASH_LENGTH = 8;
  private static DEFAULT_MAX_LENGTH = 63;

  public static url_safe_ref(ref: string, max_length?: number): string;
  // eslint-disable-next-line no-dupe-class-members
  public static url_safe_ref(ref: string, seed?: string, max_length?: number): string;
  // eslint-disable-next-line no-dupe-class-members
  public static url_safe_ref(ref: string, seed?: string | number, max_length: number = Refs.DEFAULT_MAX_LENGTH): string {
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
    const truncated_ref = sanitized_ref.substr(0, (max_length - 1) - Refs.HASH_LENGTH);
    const hash = Refs.to_digest(seed).substr(0, Refs.HASH_LENGTH);

    return `${truncated_ref}-${hash}`;
  }

  /**
   * This is not a standard base64 md5 hash as we lowercase and replace punctuation
   * This method should not be used for anything beyond conveniently adding entropy to the url_safe_ref.
   * @param uri
   */
  private static to_digest(uri: string): string {
    return crypto.createHash('md5').update(uri)
      .digest("base64") // base64 adds entropy in a more compact string
      .toLowerCase() // we need to makes everything lower which unfortunately removes some entropy
      .replace(/[\\/+=]/g, ''); // we also remove occurances of slash, plus, and equals to make url-safe
  }
}

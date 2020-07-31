import crypto from 'crypto';
import { GatewaySlugUtils, Slugs } from './slugs';

export class Refs {

  private static URL_SAFE_DELIMITER = '--';
  private static URL_SAFE_PUNCTUATION_REPLACEMENT = '-';
  private static HASH_LENGTH = 7;
  private static DEFAULT_MAX_LENGTH = 63;

  public static url_safe_ref(ref: string): string {
    if (ref === GatewaySlugUtils.StringLiteral) {
      return ref;
    }

    const hash = Refs.to_digest(ref);

    let url_safe_ref = ref.replace(new RegExp(`${Slugs.NAMESPACE_DELIMITER}`, 'g'), Refs.URL_SAFE_DELIMITER);
    url_safe_ref = url_safe_ref.replace(new RegExp(`${Slugs.TAG_DELIMITER}`, 'g'), Refs.URL_SAFE_DELIMITER);
    url_safe_ref = url_safe_ref.replace(/[^a-zA-Z0-9-]/g, Refs.URL_SAFE_PUNCTUATION_REPLACEMENT);

    // slice if the whole thing is too long
    const max_base_length = Refs.DEFAULT_MAX_LENGTH - Refs.HASH_LENGTH;
    if (url_safe_ref.length > max_base_length) {
      url_safe_ref = url_safe_ref.slice(0, max_base_length + 1);
      // trim any trailing dashes
      while (url_safe_ref.charAt(url_safe_ref.length - 1) === Refs.URL_SAFE_DELIMITER[0]) {
        url_safe_ref = url_safe_ref.substring(0, url_safe_ref.length - 1);
      }
    }

    // add the hash
    url_safe_ref += Refs.URL_SAFE_DELIMITER;
    url_safe_ref += hash.slice(0, Refs.HASH_LENGTH + 1);

    return url_safe_ref;
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

import { AxiosError } from 'axios';

export class OfflineUtils {
  // indicates that the client may be offline, useful for ignoring optional calls
  public static indicates_offline(err: AxiosError): boolean {
    return err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED';
  }
}

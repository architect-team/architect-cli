export class Errors {

  public static format(error: ApiError) {
    return `Call to ${error.path} returned ${error.statusCode}: ${error.message}`;
  }

}

export interface ApiError {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

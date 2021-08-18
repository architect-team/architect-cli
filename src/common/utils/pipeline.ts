import { AxiosInstance } from 'axios';

export class PipelineUtils {

  static POLL_INTERVAL = 10000;

  static async pollPipeline(api: AxiosInstance, pipeline_id: string) {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: pipeline } = await api.get(`/pipelines/${pipeline_id}`);
        if (pipeline.failed_at || poll_count > 180) {  // Stop checking after 30min (180 * 10s)
          clearInterval(poll);
          reject(new Error('Pipeline failed'));
        }
        if (pipeline.applied_at) {
          clearInterval(poll);
          resolve(pipeline);
        }
        poll_count += 1;
      }, PipelineUtils.POLL_INTERVAL);
    });
  }
}

import AppService from '../../app-config/service';

class PipelineAbortedError extends Error {
  constructor(deployment_id: string, deployment_link: string) {
    super();

    this.message = `Deployment ${deployment_id} was aborted\n See deployment log for more details: ${deployment_link}`;
  }
}

class DeploymentFailedError extends Error {
  constructor(pipeline_id: string, deployment_links: string[]) {
    super();

    const deployment_string = deployment_links.length > 1
      ? `${deployment_links.length} deployments`
      : '1 deployment';
    const listified_link_string = deployment_links.map((s: string) => `- ${s}`).join('\n');
    this.message = `Pipeline ${pipeline_id} failed because ${deployment_string} failed:\n${listified_link_string}`;
  }
}

export class PipelineUtils {

  // static POLL_INTERVAL = 10000;
  static POLL_INTERVAL = 1;

  static getDeploymentUrl(app: AppService, deployment: any): string {
    console.log(deployment)
    if (deployment.pipeline.environment) {
      const environment = deployment.pipeline.environment;
      return `${app.config.app_host}/${environment.account.name}/environments/${environment.name}/deployments/${deployment.id}`;
    } else if (deployment.pipeline.platform) {
      const platform = deployment.pipeline.platform;
      return `${app.config.app_host}/${platform.account.name}/platforms/${platform.name}`;
    } else {
      throw new Error('deployment was for neither a platform nor environment');
    }
  }

  static async pollPipeline(app: AppService, pipeline_id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: pipeline } = await app.api.get(`/pipelines/${pipeline_id}`);
        if (pipeline.failed_at || poll_count > 180) {  // Stop checking after 30min (180 * 10s)
          clearInterval(poll);
          // Query deployments for pipline to determine cause of failure
          const { data: deployments } = await app.api.get(`/pipelines/${pipeline.id}/deployments`);

          // Check if the deployment failed due to a user aborting the deployment
          const aborted_deployments = deployments.filter((d: any) => d.aborted_at);
          if (aborted_deployments.length !== 0) {
            const deployment_url = this.getDeploymentUrl(app, aborted_deployments[0].id);
            reject(new PipelineAbortedError(aborted_deployments[0].id, deployment_url));
          }

          // Build a list of links for the failed deployments
          const failed_deployment_links = deployments
            .filter((d: any) => d.failed_at)
            .map((d: any) => this.getDeploymentUrl(app, d));
          reject(new DeploymentFailedError(pipeline.id, failed_deployment_links));
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

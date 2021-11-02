import AppService from '../../app-config/service';
import { StringTemplateBuilder, TemplateValues } from './template-builder';

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

const deploymentUrlBuilder = new StringTemplateBuilder(
  ['app_host', 'account', 'environment', 'deployment'],
  (p: TemplateValues): string => `${p.app_host}/${p.account}/environments/${p.environment}/deployments/${p.deployment}`
);

const platformUrlBuilder = new StringTemplateBuilder(
  ['app_host', 'account', 'platform'],
  (p: TemplateValues) => `${p.app_host}/${p.account}/platforms/${p.platform}`
);

export class PipelineUtils {

  static POLL_INTERVAL = 10000;

  static async pollPipeline(app: AppService, pipeline_id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: pipeline } = await app.api.get(`/pipelines/${pipeline_id}`);
        if (pipeline.failed_at || poll_count > 180) {  // Stop checking after 30min (180 * 10s)
          clearInterval(poll);
          if (pipeline.environment) {
            const deploymentUrl = deploymentUrlBuilder.with({
              app_host: app.config.app_host,
              account: pipeline.environment.account.name,
              environment: pipeline.environment.name,
            });

            // Query deployments for pipline to determine cause of failure
            const { data: deployments } = await app.api.get(`/pipelines/${pipeline.id}/deployments`);

            // Check if the deployment failed due to a user aborting the deployment
            const aborted_deployments = deployments.filter((d: any) => d.aborted_at);
            if (aborted_deployments.length !== 0) {
              const deployment_link = deploymentUrl.build({ deployment: aborted_deployments[0].id });
              reject(new PipelineAbortedError(aborted_deployments[0].id, deployment_link));
            }

            // Build a list of links for the failed deployments
            const failed_deployment_links = deployments
              .filter((d: any) => d.failed_at)
              .map((d: any) => deploymentUrl.build({ deployment: d.id }));
            reject(new DeploymentFailedError(pipeline.id, failed_deployment_links));
          } else if (pipeline.platform) {
            const url = platformUrlBuilder.build({
              app_host: app.config.app_host,
              account: pipeline.environment.account.name,
              platform: pipeline.platform.name,
            });
            reject(new DeploymentFailedError(pipeline.id, [url]));
          }
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

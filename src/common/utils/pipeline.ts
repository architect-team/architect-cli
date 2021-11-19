import AppService from '../../app-config/service';
import { DeploymentFailedError, PipelineAbortedError, PollingTimeout } from '../errors/pipeline-errors';
import { Account } from './account';
import { Deployment } from './deployment';
import { Platform } from './platform';

export interface Pipeline {
  id: string;
  failed_at?: string;
  applied_at?: string;
  aborted_at?: string;
  environment?: {
    id: string;
    name: string;
    platform: Platform;
    account: Account;
  };
  platform?: Platform;
}

interface PipelineResult {
  poll_timeout?: boolean;
  pipeline?: Pipeline;
}

export class PipelineUtils {

  static POLL_INTERVAL = 10000;

  static getDeploymentUrl(app: AppService, deployment: Deployment): string {
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

  static async pollPipeline(app: AppService, pipeline_id: string): Promise<Pipeline> {
    return new Promise((resolve, reject) => {
      this.awaitPipeline(app, pipeline_id)
        .then((result) => {
          this.handlePipelineResult(app, result)
            .then(resolve)
            .catch(reject);
        })
        .catch(reject);
    });
  }

  static awaitPipeline(app: AppService, pipeline_id: string): Promise<PipelineResult> {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(() => {
        app.api.get(`/pipelines/${pipeline_id}`)
          .then(({ data: pipeline }) => {
            // Stop checking after 30min (180 * 10s)
            if (poll_count > 180) {
              clearInterval(poll);
              resolve({ poll_timeout: true });
            } else if (pipeline.failed_at || pipeline.applied_at) {
              clearInterval(poll);
              resolve({ pipeline });
            }
            poll_count += 1;
          })
          .catch(reject);
      }, PipelineUtils.POLL_INTERVAL);
    });
  }

  static async handlePipelineResult(app: AppService, {poll_timeout, pipeline}: PipelineResult): Promise<Pipeline> {
    // Throw timeout error if polling timed out
    if (poll_timeout) {
      throw new PollingTimeout();
    }

    // Return the pipeline if it was applied successfully
    if (pipeline && pipeline.applied_at) {
      return pipeline;
    }

    if (pipeline && pipeline.failed_at) {
      // Query deployments for pipline to determine cause of failure
      const response = await app.api.get(`/pipelines/${pipeline.id}/deployments`);
      const deployments: Deployment[] = response.data;

      // Check if the deployment failed due to a user aborting the deployment and build an abort error if so
      const aborted_deployments = deployments.filter((d: Deployment) => d.aborted_at);
      if (aborted_deployments.length !== 0) {
        const deployment_url = this.getDeploymentUrl(app, aborted_deployments[0]);
        throw new PipelineAbortedError(aborted_deployments[0].id, deployment_url);
      }

      // Build a list of links for the failed deployments
      const failed_deployment_links = deployments
        .filter((d: any) => d.failed_at)
        .map((d: any) => this.getDeploymentUrl(app, d));
      throw new DeploymentFailedError(pipeline.id, failed_deployment_links);
    }

    throw new Error(`Unexpected error while polling pipeline ${pipeline ? pipeline.id : '' }`);
  }
}

export class PipelineAbortedError extends Error {
  constructor(deployment_id: string, deployment_link: string) {
    super();

    this.message = `Deployment ${deployment_id} was aborted. See the deployment log for more details:\n${deployment_link}`;
  }
}

export class DeploymentFailedError extends Error {
  constructor(pipeline_id: string, deployment_links: string[]) {
    super();

    const deployment_string = deployment_links.length > 1 ?
      `${deployment_links.length} deployments` :
      '1 deployment';
    const listified_link_string = deployment_links.map((s: string) => `- ${s}`).join('\n');
    this.message = `Pipeline ${pipeline_id} failed because ${deployment_string} failed:\n${listified_link_string}`;
  }
}

export class PollingTimeout extends Error {
  constructor() {
    super();
    this.message = 'Timeout while polling the pipeline';
  }
}

import execa from 'execa';

const MIN_CLUSTER_VERSION = { 'major': 1, 'minor': 22 };

export class KubeClusterUtils {
  private static async getClientVersion() {
    const { stdout } = await execa('kubectl', ['version', '--client', '--output', 'json']);
    const { clientVersion } = JSON.parse(stdout);
    return clientVersion;
  }

  public static async checkClientVersion(): Promise<void> {
    const clientVersion = await this.getClientVersion();
    if (Number(clientVersion.major) < MIN_CLUSTER_VERSION.major || (Number(clientVersion.major) === MIN_CLUSTER_VERSION.major && Number(clientVersion.minor) < 22)) {
      throw new Error(`Currently, we only support Kubernetes clusters on version ${MIN_CLUSTER_VERSION.major}.${MIN_CLUSTER_VERSION.minor} or greater. Your cluster is currently on version ${clientVersion.gitVersion} which is below the minimum required version. Please upgrade your cluster before registering it with Architect.`);
    }
  }
}

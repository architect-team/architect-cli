import { CliUx } from '@oclif/core';
import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import AppConfig from '../../app-config/config';
import { CreateClusterInput } from '../../architect/cluster/cluster.utils';

const SERVICE_ACCOUNT_NAME = 'architect-agent';
const AGENT_NAMESPACE = 'architect-agent';

export class AgentClusterUtils {

  private static getLocalServerAgentIP(): string {
    return 'host.docker.internal';
  }

  private static getLocalServerAgentPort(): string {
    const container_name_results = execa.sync('docker', ['ps', '-f', 'name=agent-server', '--format', '{{.Names}}']);
    const results = execa.sync('docker', ['port', container_name_results.stdout, '9081/tcp']);
    return results.stdout.split(':')[1];
  }

  public static getServerAgentHost(agent_server_host: string): string {
    const host = agent_server_host.toLocaleLowerCase().trim();
    if (host.endsWith(':')) {
      return `${host}${this.getLocalServerAgentPort()}`;
    }
    if (host !== 'local') {
      return agent_server_host;
    }
    return `https://${this.getLocalServerAgentIP()}:${this.getLocalServerAgentPort()}`;
  }

  private static async createNamespace(kubeconfig_path: string) {
    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path)];
    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'namespace', AGENT_NAMESPACE,
    ]);
  }

  private static async createServiceAccount(set_kubeconfig: string[]) {
    try {
      await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'sa', SERVICE_ACCOUNT_NAME,
        '-o', 'json',
      ]);
      return;
    } catch {
      // This occurs if the SA does not exist.
      // This is okay and just means we need to create it.
    }
    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'sa', SERVICE_ACCOUNT_NAME,
    ]);
  }

  private static async createClusterRoleBinding(set_kubeconfig: string[]) {
    const { stdout } = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'clusterrolebinding',
      '-o', 'json',
    ]);
    const clusterrolebindings = JSON.parse(stdout);
    const sa_binding = clusterrolebindings.items.find(
      (rolebinding: any) =>
        rolebinding.subjects &&
        rolebinding.subjects.length > 0 &&
        rolebinding.subjects.find(
          (subject: any) =>
            subject.kind === 'ServiceAccount' &&
            subject.name === SERVICE_ACCOUNT_NAME
        )
    );

    // Check if cluster role binding already exists
    if (sa_binding) {
      return;
    }

    await execa('kubectl', [
      ...set_kubeconfig,
      'create',
      'clusterrolebinding',
      `${SERVICE_ACCOUNT_NAME}-cluster-admin`,
      '--clusterrole',
      'cluster-admin',
      '--serviceaccount',
      `${AGENT_NAMESPACE}:${SERVICE_ACCOUNT_NAME}`,
    ]);
  }

  private static async createServiceAccountSecret(set_kubeconfig: string[]) {
    const secret_yml = `
apiVersion: v1
kind: Secret
metadata:
  name: ${SERVICE_ACCOUNT_NAME}
  annotations:
    kubernetes.io/service-account.name: ${SERVICE_ACCOUNT_NAME}
type: kubernetes.io/service-account-token
`;
    await execa('kubectl', [
      ...set_kubeconfig,
      'apply', '-f', '-',
    ], { input: secret_yml });
  }

  public static async configureAgentCluster(
    flags: any,
    description: string,
  ): Promise<CreateClusterInput> {
    const kubeconfig_path = untildify(flags.kubeconfig);
    await this.createNamespace(kubeconfig_path);

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', AGENT_NAMESPACE];

    CliUx.ux.action.start('Creating the service account');
    await this.createServiceAccount(set_kubeconfig);
    await this.createClusterRoleBinding(set_kubeconfig);
    await this.createServiceAccountSecret(set_kubeconfig);
    CliUx.ux.action.stop();

    return {
      description,
      type: 'AGENT',
    };
  }

  public static async waitForAgent(flags: any): Promise<void> {
    const kubeconfig_path = untildify(flags.kubeconfig);
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', AGENT_NAMESPACE];

    await execa('kubectl', [
      ...set_kubeconfig,
      'rollout', 'status', 'deployment', 'agent-deployment',
    ]);
  }

  public static async installAgent(flags: any, token: string, host: string, config: AppConfig): Promise<void> {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-deployment
  labels:
    app: agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      serviceAccountName: ${SERVICE_ACCOUNT_NAME}
      containers:
        - name: agent
          image: registry.gitlab.com/architect-io/agent/client/client:latest
          env:
          - name: KUBERNETES_URL
            value: "https://kubernetes.default.svc"
          - name: ARCHITECT_TOKEN
            valueFrom:
              secretKeyRef:
                name: architect-agent-data
                key: token
          - name: AGENT_SERVER
            value: "${host}"
          - name: KUBERNETES_TOKEN
            valueFrom:
              secretKeyRef:
                name: ${SERVICE_ACCOUNT_NAME}
                key: token
          - name: KUBERNETES_CA
            valueFrom:
              secretKeyRef:
                name: ${SERVICE_ACCOUNT_NAME}
                key: ca.crt
`;
    const yamlFile = path.join(config.getConfigDir(), 'agent.yml');
    fs.writeFileSync(yamlFile, yaml);

    const kubeconfig_path = untildify(flags.kubeconfig);
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', AGENT_NAMESPACE];

    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'secret', 'generic',
      'architect-agent-data',
      `--from-literal=token=${token}`,
    ]);

    await execa('kubectl', [
      ...set_kubeconfig,
      'apply', '-f', yamlFile,
    ]);
  }
}

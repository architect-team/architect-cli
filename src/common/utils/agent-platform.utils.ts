import { CliUx } from '@oclif/core';
import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import AppConfig from '../../app-config/config';
import { CreatePlatformInput } from '../../architect/platform/platform.utils';

const SERVICE_ACCOUNT_NAME = 'architect-agent';

export class AgentPlatformUtils {

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

  public static async configureAgentPlatform(
    flags: any,
    description: string,
  ): Promise<CreatePlatformInput> {
    const kubeconfig_path = untildify(flags.kubeconfig);

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    let use_existing_sa;
    try {
      await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'sa', SERVICE_ACCOUNT_NAME,
        '-o', 'json',
      ]);
      use_existing_sa = true;
    } catch {
      use_existing_sa = false;
    }

    // Make sure the existing SA uses cluster-admin role binding
    if (use_existing_sa) {
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

      if (!sa_binding) {
        await execa('kubectl', [
          ...set_kubeconfig,
          'create',
          'clusterrolebinding',
          `${SERVICE_ACCOUNT_NAME}-cluster-admin`,
          '--clusterrole',
          'cluster-admin',
          '--serviceaccount',
          `default:${SERVICE_ACCOUNT_NAME}`,
        ]);
      }
    }

    if (!use_existing_sa) {
      CliUx.ux.action.start('Creating the service account');
      await AgentPlatformUtils.createKubernetesServiceAccount(untildify(kubeconfig_path), SERVICE_ACCOUNT_NAME);
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
      CliUx.ux.action.stop();
    }

    return {
      description,
      type: 'AGENT',
    };
  }

  public static async waitForAgent(flags: any): Promise<void> {
    const kubeconfig_path = untildify(flags.kubeconfig);
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', 'default'];

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
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', 'default'];

    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'secret', 'generic',
      'architect-agent-data',
      `--from-literal=token=${token}`,
    ])

    await execa('kubectl', [
      ...set_kubeconfig,
      'apply', '-f', yamlFile,
    ]);
  }

  public static async createKubernetesServiceAccount(kubeconfig_path: string, sa_name: string): Promise<void> {
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', 'default'];

    // Create the service account
    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'sa', sa_name,
    ]);

    // Bind the service account to the cluster-admin role
    await execa('kubectl', [
      ...set_kubeconfig,
      'create',
      'clusterrolebinding',
      `${sa_name}-cluster-admin`,
      '--clusterrole',
      'cluster-admin',
      '--serviceaccount',
      `default:${sa_name}`,
    ]);
  }
}

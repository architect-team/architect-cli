import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import BaseCommand from '../../base-command';

type CertificateResponse = {
  spec: {
    dnsNames: string[];
  };
  status: {
    notAfter: Date;
    notBefore: Date;
    renewalTime: Date;
  }
};

export default class GetEnvironmentIngressesCmd extends BaseCommand {
  static description = 'List the resolvable URLs for services exposed by your environment';
  static aliases = ['environment:ingresses', 'envs:ingresses', 'env:ingresses'];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
  };

  static args = [
    {
      sensitive: false,
      required: false,
      name: 'environment',
      description: 'Name to give the environment',
      parse: async (value: string): Promise<string> => value.toLowerCase(),
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetEnvironmentIngressesCmd);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, { environment_name: args.environment });

    const { data: certificates } = await this.app.api.get<CertificateResponse[]>(`/environments/${environment.id}/certificates`);

    if (certificates.length > 0) {
      const dns_records: string[] = [];
      for (const cert of certificates) {
        for (const dns_name of cert.spec.dnsNames
          .filter(dns_name => !dns_name.startsWith('env--'))) {
            dns_records.push(dns_name);
          }
      }
      this.log(
        dns_records
          .map(record => `https://${record}`)
          .join('\r\n'),
      );
    }
  }
}

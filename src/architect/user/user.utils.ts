import AppService from '../../app-config/service';

export default class UserUtils {
  static async isAdmin(app: AppService, account_id: string): Promise<boolean> {
    const { data: user } = await app.api.get('/users/me');
    const membership = user.memberships?.find((membership: any) => membership.account.id === account_id);
    return !!membership && membership.role !== 'MEMBER';
  }
}

import AppService from '../../app-config/service';
import Account from '../account/account.entity';
import User from './user.entity';

export default interface Membership {
  id: string;
  user: User;
  account: Account;
  role: string;
}

export default class UserUtils {
  static async isAdmin(app: AppService, account_id: string): Promise<boolean> {
    const { data: user } = await app.api.get('/users/me');
    const membership = user.memberships?.find((membership: Membership) => membership.account.id === account_id);
    return !!membership && membership.role !== 'MEMBER';
  }
}

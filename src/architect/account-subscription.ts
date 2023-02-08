import Account from './account/account.entity';

export default interface AccountSubscription {
  subscription_tier: 'Free' | 'Team' | 'Growth';
  account: Account;
}

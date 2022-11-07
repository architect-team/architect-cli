export interface DependencyStateChange {
  type: string;
  key?: string;
  before: any;
  after: any;
  action: ('create' | 'delete' | 'update' | 'no-op');
}

export class DependencyState {
  action: ('create' | 'delete' | 'update' | 'no-op') = 'no-op';
  applied_at?: Date;
  failed_at?: Date;
  started_at?: Date;
  changes: DependencyStateChange[] = [];
}

export interface DependencyStateChange {
  type: string;
  key?: string;
  before: any;
  after: any;
  action: ('create' | 'delete' | 'update' | 'no-op');
}

export interface DependencyState {
  action: ('create' | 'delete' | 'update' | 'no-op');
  applied_at?: Date;
  failed_at?: Date;
  started_at?: Date;
  changes: DependencyStateChange[];
  healthy_replicas: number;
  replicas: number;
  warnings: string[];
}

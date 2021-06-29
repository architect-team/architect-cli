import { Type } from 'class-transformer';
import { IsInstance, IsOptional, IsString } from 'class-validator';
import { ValidatableConfig } from '../base-spec';
import { InterfaceSpecV1 } from '../common/interface-v1';

export class IngressSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  subdomain?: string;
}

export class ComponentInterfaceSpecV1 extends InterfaceSpecV1 {
  @Type(() => IngressSpecV1)
  @IsOptional({ always: true })
  @IsInstance(IngressSpecV1, { always: true })
  ingress?: IngressSpecV1;
}

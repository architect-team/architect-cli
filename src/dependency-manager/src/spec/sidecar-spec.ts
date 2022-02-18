import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { LivenessProbeSpec } from './common-spec';
import { ResourceSpec } from './resource-spec';

@JSONSchema({
  description: 'A container to run as a sidecar to the related component or service',
})
export class SidecarSpec extends ResourceSpec {
  @IsOptional()
  @JSONSchema({
    type: 'boolean',
    description: 'If the sidecar should be started or not.',
    default: SidecarSpec.default_enabled,
  })
  enabled?: boolean;
  public static default_enabled = true;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpec;
}

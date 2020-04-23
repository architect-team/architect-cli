import { IsInstance, IsOptional, IsString } from "class-validator";
import { BaseSpec } from "../../base-spec";
import { validateNested } from "../../utils/validation";
import { LivenessProbeV1 } from "./liveness-probe";

export class ApiSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString({ each: true })
  definitions?: string[];

  @IsOptional()
  @IsInstance(LivenessProbeV1)
  liveness_probe?: LivenessProbeV1;

  constructor(plain?: any) {
    super(plain);

    if (this.liveness_probe) {
      this.liveness_probe = new LivenessProbeV1(this.liveness_probe);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'liveness_probe', errors);
    return errors;
  }
}
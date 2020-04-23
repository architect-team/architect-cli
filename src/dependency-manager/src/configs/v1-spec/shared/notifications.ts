import { IsOptional, IsString } from "class-validator";
import { BaseSpec } from "../../base-spec";

export class NotificationSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;
}
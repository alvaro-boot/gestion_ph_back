import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { FollowUpType } from '../../common/enums';

export class UpdateSeguimientoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  @IsOptional()
  @IsEnum(FollowUpType)
  followUpType?: FollowUpType;
}

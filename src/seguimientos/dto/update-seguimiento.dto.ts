import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
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
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  nextActionAt?: string | null;

  @IsOptional()
  @IsEnum(FollowUpType)
  followUpType?: FollowUpType;
}

import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FollowUpType } from '../../common/enums';

export class CreateSeguimientoDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  clientProcessId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FollowUpType)
  followUpType?: FollowUpType;

  @IsDateString()
  occurredAt: string;
}

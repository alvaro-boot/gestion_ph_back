import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { StageType } from '../../common/enums';

export class CreateStageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  orderIndex: number;

  @IsOptional()
  @IsEnum(StageType)
  stageType?: StageType;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minDurationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDurationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  formDeadlineDays?: number;

  @IsOptional()
  @IsUrl()
  formUrl?: string;
}

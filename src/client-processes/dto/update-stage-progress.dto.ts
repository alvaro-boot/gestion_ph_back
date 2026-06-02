import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { StageProgressStatus } from '../../common/enums';

export class UpdateStageProgressDto {
  @IsOptional()
  @IsEnum(StageProgressStatus)
  status?: StageProgressStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

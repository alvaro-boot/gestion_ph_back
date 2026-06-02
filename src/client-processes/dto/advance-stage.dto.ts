import { IsDateString, IsOptional } from 'class-validator';

export class AdvanceStageDto {
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  nextStartedAt?: string;
}

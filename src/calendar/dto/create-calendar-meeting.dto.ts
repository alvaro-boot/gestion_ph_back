import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCalendarMeetingDto {
  @IsUUID()
  stageProgressId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

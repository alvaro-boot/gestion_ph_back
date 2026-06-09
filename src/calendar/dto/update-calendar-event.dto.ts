import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CalendarEventStatus } from '../../common/enums';

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  completionNotes?: string;

  @IsOptional()
  @IsString()
  unfulfilledReason?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsEnum(CalendarEventStatus)
  status?: CalendarEventStatus;
}

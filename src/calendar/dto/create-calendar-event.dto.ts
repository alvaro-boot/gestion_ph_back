import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CalendarEventType } from '../../common/enums';

export class CreateCalendarEventDto {
  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  clientProcessId?: string;

  @IsEnum(CalendarEventType)
  eventType: CalendarEventType;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueAt: string;
}

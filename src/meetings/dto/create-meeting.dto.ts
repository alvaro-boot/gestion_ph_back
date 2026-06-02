import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MeetingStatus } from '../../common/enums';

export class CreateMeetingDto {
  @IsUUID()
  stageProgressId: string;

  @IsString()
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;
}

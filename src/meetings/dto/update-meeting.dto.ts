import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MeetingStatus } from '../../common/enums';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;
}

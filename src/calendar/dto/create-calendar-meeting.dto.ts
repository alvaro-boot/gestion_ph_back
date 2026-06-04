import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateCalendarMeetingDto {
  /** Si se omite, se crea una reunión general (sin conjunto). */
  @IsOptional()
  @IsUUID()
  processId?: string;

  /** Si el proceso está activo, puede indicar la etapa; si no, se usa la etapa en curso. */
  @IsOptional()
  @IsUUID()
  stageProgressId?: string;

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

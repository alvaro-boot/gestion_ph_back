import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class StartProcessDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  processTemplateId: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  /** Etapa en la que va el cliente (1 = primera). Las anteriores quedan hechas sin fecha. */
  @IsOptional()
  @IsInt()
  @Min(1)
  currentStageNumber?: number;
}

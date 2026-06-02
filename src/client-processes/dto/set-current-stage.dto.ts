import { IsInt, Min } from 'class-validator';

/** Etapa actual del cliente (1 = primera etapa de la plantilla). */
export class SetCurrentStageDto {
  @IsInt()
  @Min(1)
  stageNumber: number;
}

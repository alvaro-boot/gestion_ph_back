import { ProcessTemplate } from '../entities/process-template.entity';

/** Plantilla de proceso obsoleta: el seguimiento real son los registros en `seguimientos`. */
export const SEGUIMIENTO_TEMPLATE_NAME = 'Seguimiento';

export function isSeguimientoTemplate(
  template: Pick<ProcessTemplate, 'name'> | null | undefined,
): boolean {
  return (
    template?.name?.trim().toLowerCase() ===
    SEGUIMIENTO_TEMPLATE_NAME.toLowerCase()
  );
}

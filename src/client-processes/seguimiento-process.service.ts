import { Injectable } from '@nestjs/common';
import { ProcessTemplate } from '../entities/process-template.entity';
import { isSeguimientoTemplate } from '../common/seguimiento-template';

/** Utilidad legacy: la plantilla «Seguimiento» ya no se usa como proceso. */
@Injectable()
export class SeguimientoProcessService {
  isSeguimientoTemplate(template: ProcessTemplate) {
    return isSeguimientoTemplate(template);
  }
}

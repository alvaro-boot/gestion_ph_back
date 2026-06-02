import { PartialType } from '@nestjs/mapped-types';
import { CreateProcessTemplateDto } from './create-process-template.dto';

export class UpdateProcessTemplateDto extends PartialType(
  CreateProcessTemplateDto,
) {}

import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  nextContactAt?: string | null;

  @IsOptional()
  @IsString()
  nextContactTitle?: string | null;
}

import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  nextContactAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  nextContactTitle?: string | null;
}

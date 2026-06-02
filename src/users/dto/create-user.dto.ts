import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class UpdateSuperAdminDto {
  @ApiPropertyOptional({
    description:
      'First name of the super admin. Will default to "Unknown" if not provided',
    example: 'John',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  first_name?: string;

  @ApiPropertyOptional({
    description:
      'Last name of the super admin. Will default to "User" if not provided',
    example: 'Doe',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Email address of the super admin. Must be unique',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Password for the super admin account. Will be hashed before storage',
    example: 'strongPassword123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

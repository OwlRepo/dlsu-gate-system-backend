import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsBoolean,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  deviceId?: string[];
}

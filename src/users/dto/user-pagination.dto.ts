import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class UserPaginationDto extends BasePaginationDto {
  @ApiPropertyOptional({
    enum: ['admin', 'employee', 'super-admin'],
    description: 'Filter by user type',
  })
  @IsEnum(['admin', 'employee', 'super-admin'])
  @IsOptional()
  type?: 'admin' | 'employee' | 'super-admin';
}

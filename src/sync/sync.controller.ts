import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { CacheTTL } from '../decorators/cache-control.decorator';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('students')
  @ApiOperation({
    summary: 'Get all non-archived students',
    description:
      'Returns complete list of non-archived students for mobile database synchronization',
  })
  @CacheTTL(3600000) // 1 hour
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved students',
    schema: {
      type: 'object',
      properties: {
        students: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              ID_Number: { type: 'string', nullable: true },
              Name: { type: 'string', nullable: true },
              Lived_Name: { type: 'string', nullable: true },
              Remarks: { type: 'string', nullable: true },
              Photo: { type: 'string', nullable: true },
              Campus_Entry: { type: 'string', nullable: true },
              Unique_ID: { type: 'string', nullable: true },
              isArchived: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Error retrieving data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getAllStudents() {
    return this.syncService.getAllStudents();
  }
}

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check system health',
    description:
      'Returns the health status of the application and its database connection',
  })
  @ApiResponse({
    status: 200,
    description: 'Application and database are healthy',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - Database or application is unhealthy',
    schema: {
      example: {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Unable to connect to database',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Unable to connect to database',
          },
        },
      },
    },
  })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeeModule } from './employee/employee.module';
import { ReportsModule } from './reports/reports.module';
import { LoginModule } from './login/login.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import databaseConfig from './config/database.config';
import { HealthModule } from './health/health.module';
import { DatabaseSyncModule } from './database-sync/database-sync.module';
import { redisConfig } from './config/redis.config';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpCacheInterceptor } from './interceptors/cache.interceptor';
import { CacheService } from './services/cache.service';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '60m' },
    }),
    EmployeeModule,
    ReportsModule,
    LoginModule,
    AdminModule,
    UsersModule,
    SuperAdminModule,
    HealthModule,
    DatabaseSyncModule,
    CacheModule.register(redisConfig),
    AuthModule,
    StudentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get the DataSource from the application context
  const dataSource = app.get(DataSource);

  // Initialize database
  try {
    // Create tables if they don't exist
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS sync_schedule (
        id SERIAL PRIMARY KEY,
        "scheduleNumber" INTEGER UNIQUE NOT NULL,
        time VARCHAR(5) NOT NULL,
        "cronExpression" VARCHAR(100) NOT NULL,
        "lastSyncTime" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        "ID_Number" VARCHAR(255) UNIQUE NOT NULL,
        "Name" VARCHAR(255),
        "Lived_Name" VARCHAR(255),
        "Remarks" TEXT,
        "Photo" TEXT,
        "Campus_Entry" VARCHAR(255),
        "Unique_ID" VARCHAR(255),
        "isArchived" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }

  app.set('trust proxy', 1);

  const config = new DocumentBuilder()
    .setTitle('DLSU Gate System API')
    .setDescription('API for DLSU Gate System')
    .setVersion('1.0')
    .addTag('DLSU Gate System API')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'DLSU Gate System API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  app.enableCors();

  const guard = app.get(JwtAuthGuard);
  app.useGlobalGuards(guard);

  // Remove the environment check and always serve static files
  app.useStaticAssets(join(process.cwd(), 'persistent_uploads'), {
    prefix: '/persistent_uploads',
  });

  // Add graceful shutdown
  app.enableShutdownHooks();

  // Add compression
  app.use(compression());

  // Add rate limiting with increased limit
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // increased from 100 to 1000 requests per windowMs
    }),
  );

  await app.listen(process.env.PORT || 3000);
}
bootstrap();

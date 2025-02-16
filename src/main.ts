import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as compression from 'compression';
import { rateLimit } from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
    exposedHeaders: 'Authorization',
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('DLSU Gate System API')
    .setDescription('API documentation for DLSU Gate System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

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

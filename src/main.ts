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

  const config = new DocumentBuilder()
    .setTitle('DLSU Admin API')
    .setDescription('API for DLSU Admin')
    .setVersion('1.0')
    .addTag('DLSU Admin')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'DLSU Admin API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const guard = app.get(JwtAuthGuard);
  app.useGlobalGuards(guard);

  // Configure static file serving
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/static/uploads/',
  });

  // Serve files from persistent_uploads directory
  app.useStaticAssets(join(process.cwd(), '..', 'persistent_uploads'), {
    prefix: '/persistent_uploads',
  });

  // Add graceful shutdown
  app.enableShutdownHooks();

  // Add compression
  app.use(compression());

  // Add rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    }),
  );

  // Use PORT environment variable with fallback to original port
  const port = process.env.PORT || 51742;
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}
bootstrap();

import { Module } from '@nestjs/common';
import { ScreensaverController } from './screensaver.controller';
import { ScreensaverService } from './screensaver.service';

@Module({
  controllers: [ScreensaverController],
  providers: [ScreensaverService],
  exports: [ScreensaverService],
})
export class ScreensaverModule {}

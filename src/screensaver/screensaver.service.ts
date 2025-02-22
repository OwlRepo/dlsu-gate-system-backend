import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ScreensaverService {
  private readonly uploadDir = join(process.cwd(), 'persistent_uploads');

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.initializeUploadDirectory();
  }

  private async initializeUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async saveScreensaver(file: Express.Multer.File, token: string) {
    // Verify token and check user type
    try {
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const decoded = this.jwtService.verify(token);
      // Check if the user type is in the role property (common JWT structure)
      const userType = decoded.role || decoded.userType || decoded.type;

      console.log('Decoded token:', decoded); // For debugging
      console.log('User type:', userType); // For debugging

      if (userType !== 'super-admin') {
        throw new UnauthorizedException(
          'Only super admins can upload screensavers',
        );
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      throw new UnauthorizedException(
        'Invalid token or insufficient permissions',
      );
    }

    const fileExtension = file.mimetype.split('/')[1];
    const fileName = `screensaver-image.${fileExtension}`;
    const filePath = join(this.uploadDir, fileName);

    // First save the new screensaver with a temporary name
    const tempFileName = `screensaver-image.new.${fileExtension}`;
    const tempFilePath = join(this.uploadDir, tempFileName);

    try {
      // Save new screensaver with temporary name
      await fs.writeFile(tempFilePath, file.buffer);

      // Remove old screensaver if exists
      const files = await fs.readdir(this.uploadDir);
      for (const file of files) {
        if (file.startsWith('screensaver-image.') && !file.includes('.new.')) {
          await fs.unlink(join(this.uploadDir, file));
        }
      }

      // Rename temporary file to final name
      await fs.rename(tempFilePath, filePath);

      return { message: 'Screensaver uploaded successfully' };
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore error if temp file doesn't exist
      }
      console.error('Error saving screensaver:', error);
      throw new Error('Failed to save screensaver');
    }
  }

  async getScreensaverPath(): Promise<string> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const screensaverFile = files.find((file) =>
        file.startsWith('screensaver-image.'),
      );

      if (!screensaverFile) {
        throw new NotFoundException('No screensaver image found');
      }

      return join(this.uploadDir, screensaverFile);
    } catch (error) {
      console.log('Error getting screensaver path:', error);
      throw new NotFoundException('No screensaver image found');
    }
  }

  async getScreensaverInfo() {
    try {
      // Add retries for file reading
      let retryCount = 0;
      const maxRetries = 10;

      while (retryCount < maxRetries) {
        try {
          const files = await fs.readdir(this.uploadDir);
          const screensaverFile = files.find((file) =>
            file.startsWith('screensaver-image.'),
          );

          if (screensaverFile) {
            const stats = await fs.stat(join(this.uploadDir, screensaverFile));
            const isDev = process.env.NODE_ENV === 'development';
            const isRailway = process.env.RAILWAY_STATIC_URL || false;

            let baseUrl;
            if (isDev) {
              baseUrl = 'http://localhost';
            } else if (isRailway) {
              baseUrl = 'https://dlsu-portal-be-production.up.railway.app';
            } else {
              baseUrl = this.configService.get<string>('BASE_URL');
            }

            return {
              status: 'success',
              message: 'Screensaver found',
              data: {
                filename: screensaverFile,
                lastModified: stats.mtime,
                size: stats.size,
                url: `${baseUrl}/persistent_uploads/${screensaverFile}`,
                exists: true,
              },
            };
          }

          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s between retries
          }
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        status: 'empty',
        message: 'No screensaver image has been uploaded yet',
        data: null,
      };
    } catch (error) {
      console.error('Error getting screensaver info:', error);
      return {
        status: 'error',
        message: 'Error retrieving screensaver information',
        data: null,
      };
    }
  }
}

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

    // Remove old screensaver if exists
    try {
      const files = await fs.readdir(this.uploadDir);
      for (const file of files) {
        if (file.startsWith('screensaver-image.')) {
          await fs.unlink(join(this.uploadDir, file));
        }
      }
    } catch (error) {
      console.error('Error deleting old screensaver:', error);
    }

    // Save new screensaver
    await fs.writeFile(filePath, file.buffer);
    return { message: 'Screensaver uploaded successfully' };
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
      const files = await fs.readdir(this.uploadDir);
      const screensaverFile = files.find((file) =>
        file.startsWith('screensaver-image.'),
      );

      if (!screensaverFile) {
        return {
          status: 'empty',
          message: 'No screensaver image has been uploaded yet',
          data: null,
        };
      }

      const isDev = process.env.NODE_ENV === 'development';
      const isRailway = process.env.RAILWAY_STATIC_URL || false;

      // Handle different environments
      let baseUrl;
      if (isDev) {
        baseUrl = process.env.BASE_URL || 'http://localhost';
      } else if (isRailway) {
        baseUrl = process.env.RAILWAY_STATIC_URL;
      } else {
        baseUrl = this.configService.get<string>('BASE_URL') || '';
      }

      const stats = await fs.stat(join(this.uploadDir, screensaverFile));

      console.log('Environment:', process.env.NODE_ENV);
      console.log('Is Railway:', isRailway);
      console.log('Base URL:', baseUrl);
      console.log('File path:', join(this.uploadDir, screensaverFile));

      // Remove trailing slash from baseUrl if it exists
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

      return {
        status: 'success',
        message: 'Screensaver found',
        data: {
          filename: screensaverFile,
          lastModified: stats.mtime,
          size: stats.size,
          url: `${cleanBaseUrl}/persistent_uploads/${screensaverFile}`,
          exists: true,
        },
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

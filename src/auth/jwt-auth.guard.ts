import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for public route
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      console.log('No token found in request');
      throw new UnauthorizedException('No token provided');
    }

    // Check if token is blacklisted
    if (this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Check if current time is exactly between 23:00:00 and 23:00:05
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();

      // Block access only during the first 5 seconds of 23:00
      if (currentHour === 23 && currentMinutes === 0 && currentSeconds < 5) {
        throw new UnauthorizedException(
          'Daily token reset at 11 PM. Please wait 5 seconds and try again.',
        );
      }

      console.log('Token payload:', payload);
      request['user'] = payload;
      return true;
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

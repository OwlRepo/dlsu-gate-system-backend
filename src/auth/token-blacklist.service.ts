import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenBlacklistService {
  private blacklistedTokens: Set<string> = new Set();

  constructor(private readonly jwtService: JwtService) {}

  async blacklistToken(token: string) {
    if (!token) return;

    try {
      // Verify the token is valid before blacklisting
      await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      this.blacklistedTokens.add(token);

      // Get token expiration and remove from blacklist after it expires
      const decoded = this.jwtService.decode(token);
      const exp = decoded['exp'] * 1000; // Convert to milliseconds

      setTimeout(() => {
        this.blacklistedTokens.delete(token);
      }, exp - Date.now());
    } catch (error) {
      // Token is invalid, no need to blacklist
      console.error('Error blacklisting token:', error.message);
      return;
    }
  }

  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }
}

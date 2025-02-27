import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenBlacklist } from './entities/token-blacklist.entity';

@Injectable()
export class TokenBlacklistService {
  private userTokens: Map<string, string> = new Map(); // userId_role -> token

  constructor(
    @InjectRepository(TokenBlacklist)
    private tokenBlacklistRepository: Repository<TokenBlacklist>,
  ) {}

  async blacklistToken(token: string) {
    const blacklistedToken = this.tokenBlacklistRepository.create({
      token,
      blacklistedAt: new Date(),
    });
    await this.tokenBlacklistRepository.save(blacklistedToken);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistedToken = await this.tokenBlacklistRepository.findOne({
      where: { token },
    });
    return !!blacklistedToken;
  }

  async trackUserToken(userId: number, role: string, token: string) {
    const key = `${userId}_${role}`;
    const previousToken = this.userTokens.get(key);

    if (previousToken) {
      await this.blacklistToken(previousToken);
    }

    this.userTokens.set(key, token);
  }

  async getActiveTokensByUser(userId: number, role: string): Promise<string[]> {
    const key = `${userId}_${role}`;
    const token = this.userTokens.get(key);
    return token ? [token] : [];
  }
}

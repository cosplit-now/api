import { createHash, randomBytes } from "crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import type { EnvironmentVariables } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import type { AppUser, TokenResponse } from "./auth.types";

interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Short-lived single-use codes issued after Google OAuth callback.
   * The web client exchanges this code for tokens via POST /auth/exchange.
   * TTL: 5 minutes. For multi-instance deployments, replace with Redis.
   */
  private readonly exchangeCodes = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  private readonly refreshTokenExpiresDays: number;
  private readonly googleClientId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.refreshTokenExpiresDays = configService.get(
      "REFRESH_TOKEN_EXPIRES_DAYS",
      { infer: true },
    );
    this.googleClientId = configService.get("GOOGLE_CLIENT_ID", {
      infer: true,
    });
  }

  // ── User ──────────────────────────────────────────────────────────────────

  async findOrCreateUser(profile: OAuthProfile): Promise<AppUser> {
    // Step 1: look up by (provider, providerAccountId)
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    // Step 2: fall back to email — auto-link when email matches an existing user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingUser) {
      await this.prisma.oAuthAccount.create({
        data: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          userId: existingUser.id,
        },
      });
      this.logger.log(
        `Linked ${profile.provider} account to existing user ${existingUser.id} (${existingUser.email})`,
      );
      return existingUser;
    }

    // Step 3: create a new user + OAuthAccount
    const newUser = await this.prisma.user.create({
      data: {
        name: profile.name,
        email: profile.email,
        emailVerified: true,
        image: profile.picture ?? null,
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
    });
    this.logger.log(`New user created: ${newUser.id} (${newUser.email})`);
    return newUser;
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  async generateTokens(userId: string): Promise<TokenResponse> {
    const expiresIn = this.parseExpiresIn(
      this.configService.get("JWT_EXPIRES_IN", { infer: true }),
    );

    const accessToken = this.jwtService.sign({ sub: userId });

    const rawRefreshToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiresDays);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: rawRefreshToken,
    };
  }

  async refreshTokens(rawRefreshToken: string): Promise<TokenResponse> {
    const tokenHash = createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Generate new token pair
    const newTokens = await this.generateTokens(record.userId);

    // Find the newly created refresh token record for the audit trail
    const newHash = createHash("sha256")
      .update(newTokens.refresh_token)
      .digest("hex");
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
      select: { id: true },
    });

    // Revoke the old token and record which token replaced it
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newRecord?.id ?? null },
    });

    this.logger.log(`Refresh token rotated for user ${record.userId}`);
    return newTokens;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Web OAuth exchange code ───────────────────────────────────────────────

  generateExchangeCode(userId: string): string {
    // Prune expired codes before inserting a new one
    const now = new Date();
    for (const [key, value] of this.exchangeCodes) {
      if (value.expiresAt < now) this.exchangeCodes.delete(key);
    }

    const code = randomBytes(16).toString("hex");
    this.exchangeCodes.set(code, {
      userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    return code;
  }

  consumeExchangeCode(code: string): string | null {
    const entry = this.exchangeCodes.get(code);
    if (!entry) return null;
    this.exchangeCodes.delete(code); // single-use
    if (entry.expiresAt < new Date()) return null;
    return entry.userId;
  }

  // ── Mobile: verify Google ID token ───────────────────────────────────────

  async verifyGoogleIdToken(idToken: string): Promise<OAuthProfile> {
    const client = new OAuth2Client(this.googleClientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException("Invalid Google ID token");
    }

    if (!payload?.email) {
      throw new UnauthorizedException("No email in Google ID token");
    }

    return {
      provider: "google",
      providerAccountId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Convert JWT expiresIn string (e.g. "1h", "30m") to seconds. */
  private parseExpiresIn(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 3600;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return n * (multipliers[unit] ?? 1);
  }
}

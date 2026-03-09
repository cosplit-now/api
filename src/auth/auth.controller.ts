import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import type { EnvironmentVariables } from "../config/env.schema";
import { CurrentUser, Public } from "./decorators";
import type { AppUser } from "./auth.types";
import { AuthService } from "./auth.service";
import { ExchangeCodeDto } from "./dto/exchange-code.dto";
import { GoogleTokenDto } from "./dto/google-token.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.frontendUrl = configService.get("FRONTEND_URL", { infer: true });
  }

  // ── Web OAuth flow ────────────────────────────────────────────────────────

  /**
   * Step 1: Redirect user to Google consent screen.
   * GET /auth/google
   */
  @Get("google")
  @Public()
  @UseGuards(AuthGuard("google"))
  googleLogin() {
    // Passport redirects to Google — this method body never executes.
  }

  /**
   * Step 2: Google redirects back here with an auth code.
   * Passport exchanges it for the user profile, then we issue a short-lived
   * one-time exchange code and redirect the browser to the frontend.
   * GET /auth/google/callback
   */
  @Get("google/callback")
  @Public()
  @UseGuards(AuthGuard("google"))
  googleCallback(@CurrentUser() user: AppUser, @Res() res: Response) {
    const code = this.authService.generateExchangeCode(user.id);
    res.redirect(`${this.frontendUrl}?code=${code}`);
  }

  /**
   * Step 3 (web): Frontend exchanges the one-time code for tokens.
   * POST /auth/exchange
   * Body: { code: string }
   * Response: TokenResponse
   */
  @Post("exchange")
  @Public()
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeCodeDto) {
    const userId = this.authService.consumeExchangeCode(dto.code);
    if (!userId) throw new UnauthorizedException("Invalid or expired code");
    return this.authService.generateTokens(userId);
  }

  // ── Mobile flow ───────────────────────────────────────────────────────────

  /**
   * Mobile clients call this with a Google ID token obtained via the
   * native Google Sign-In SDK (iOS / Android).
   * POST /auth/google/token
   * Body: { id_token: string }
   * Response: TokenResponse
   */
  @Post("google/token")
  @Public()
  @HttpCode(HttpStatus.OK)
  async googleToken(@Body() dto: GoogleTokenDto) {
    const profile = await this.authService.verifyGoogleIdToken(dto.id_token);
    const user = await this.authService.findOrCreateUser(profile);
    return this.authService.generateTokens(user.id);
  }

  // ── Token management ──────────────────────────────────────────────────────

  /**
   * Refresh an expired access token using a valid refresh token.
   * POST /auth/refresh
   * Body: { refresh_token: string }
   * Response: TokenResponse (new access_token + rotated refresh_token)
   */
  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refresh_token);
  }

  /**
   * Revoke the current refresh token (logout).
   * DELETE /auth/session
   * Body: { refresh_token: string }
   */
  @Delete("session")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.revokeRefreshToken(dto.refresh_token);
  }

  // ── Current user ──────────────────────────────────────────────────────────

  /**
   * Return the currently authenticated user.
   * GET /auth/me
   */
  @Get("me")
  me(@CurrentUser() user: AppUser) {
    return user;
  }
}

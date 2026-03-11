import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { CurrentUser, Public } from "./decorators";
import type { AppUser } from "./auth.types";
import { AuthService } from "./auth.service";
import { ExchangeCodeDto } from "./dto/exchange-code.dto";
import { GoogleTokenDto } from "./dto/google-token.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { GoogleAuthGuard } from "./guards/google-auth.guard";

@Controller({ version: "1", path: "auth" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Web OAuth flow ────────────────────────────────────────────────────────

  /**
   * Step 1: Redirect user to Google consent screen.
   * GET /v1/auth/google?redirect_uri=<frontend_callback_url>&state=<opaque>
   */
  @Get("google")
  @Public()
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Passport redirects to Google — this method body never executes.
  }

  /**
   * Step 2: Google redirects back here with an auth code.
   * Passport exchanges it for the user profile, then we issue a short-lived
   * one-time exchange code and redirect the browser to redirect_uri from the
   * verified OAuth state payload.
   * GET /v1/auth/google/callback
   */
  @Get("google/callback")
  @Public()
  @UseGuards(AuthGuard("google"))
  googleCallback(
    @CurrentUser() user: AppUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const serializedState = this.getSingleQueryParam(req, "state");
    if (!serializedState) {
      throw new UnauthorizedException("Missing OAuth state");
    }

    const { redirectUri, state } =
      this.authService.consumeOAuthState(serializedState);
    const code = this.authService.generateExchangeCode(user.id);
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    if (state !== undefined) {
      callbackUrl.searchParams.set("state", state);
    }

    res.redirect(callbackUrl.toString());
  }

  /**
   * Step 3 (web): Frontend exchanges the one-time code for tokens.
   * POST /v1/auth/exchange
   * Body: { code: string }
   * Response: TokenResponse
   */
  @Post("exchange")
  @Public()
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeCodeDto) {
    if (!dto?.code) {
      throw new BadRequestException("code is required");
    }

    const userId = this.authService.consumeExchangeCode(dto.code);
    if (!userId) throw new UnauthorizedException("Invalid or expired code");
    return this.authService.generateTokens(userId);
  }

  // ── Mobile flow ───────────────────────────────────────────────────────────

  /**
   * Mobile clients call this with a Google ID token obtained via the
   * native Google Sign-In SDK (iOS / Android).
   * POST /v1/auth/google/token
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
   * POST /v1/auth/refresh
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
   * DELETE /v1/auth/session
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
   * GET /v1/auth/me
   */
  @Get("me")
  me(@CurrentUser() user: AppUser) {
    return user;
  }

  private getSingleQueryParam(req: Request, key: string): string | undefined {
    const value = req.query[key];
    if (Array.isArray(value)) {
      throw new UnauthorizedException(`Invalid OAuth ${key}`);
    }

    if (typeof value !== "string") {
      return undefined;
    }

    return value;
  }
}

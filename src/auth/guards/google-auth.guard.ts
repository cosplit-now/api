import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly authService: AuthService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const request = context.switchToHttp().getRequest<Request>();
    const redirectUri = this.getSingleQueryParam(request, "redirect_uri");
    if (!redirectUri) {
      throw new BadRequestException("redirect_uri is required");
    }

    const state = this.getSingleQueryParam(request, "state");

    return {
      state: this.authService.generateOAuthState(redirectUri, state),
    };
  }

  private getSingleQueryParam(
    request: Request,
    key: string,
  ): string | undefined {
    const value = request.query[key];
    if (Array.isArray(value)) {
      throw new BadRequestException(`${key} must be a single value`);
    }

    if (typeof value !== "string") {
      return undefined;
    }

    return value;
  }
}

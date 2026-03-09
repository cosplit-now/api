import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";
import type { EnvironmentVariables } from "../../config/env.schema";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    super({
      clientID: configService.get("GOOGLE_CLIENT_ID", { infer: true }),
      clientSecret: configService.get("GOOGLE_CLIENT_SECRET", { infer: true }),
      callbackURL: configService.get("GOOGLE_CALLBACK_URL", { infer: true }),
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error("No email in Google profile"), false);
      return;
    }
    const user = await this.authService.findOrCreateUser({
      email,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
    });
    done(null, user);
  }
}

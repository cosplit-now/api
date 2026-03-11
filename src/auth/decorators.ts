import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { Request } from "express";
import type { AppUser } from "./auth.types";

export const IS_PUBLIC_KEY = "isPublic";

/** Mark a route as publicly accessible (no JWT required). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Extract the authenticated user from the request (reads req.user). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AppUser }>();
    return request.user as AppUser;
  },
);

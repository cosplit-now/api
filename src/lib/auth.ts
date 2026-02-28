import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous } from "better-auth/plugins";
import { type EnvironmentVariables } from "../config/env.schema";
import { prisma } from "./prisma";

const parseOriginList = (value: string): string[] =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

type AuthEnvConfig = Pick<
  EnvironmentVariables,
  "TRUSTED_ORIGINS" | "SESSION_COOKIE_DOMAIN"
>;

export const createAuth = (config: AuthEnvConfig) => {
  const trustedOrigins = parseOriginList(config.TRUSTED_ORIGINS);
  const sessionCookieDomain = config.SESSION_COOKIE_DOMAIN;

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    advanced: sessionCookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: sessionCookieDomain,
          },
        }
      : undefined,
    trustedOrigins,
    plugins: [
      anonymous({
        onLinkAccount: ({ anonymousUser, newUser }) => {
          // perform actions like moving the cart items from anonymous user to the new user
          console.log(
            `Linking anonymous user ${anonymousUser.user.id} to new user ${newUser.user.id}`,
          );
        },
      }),
    ],
  });
};

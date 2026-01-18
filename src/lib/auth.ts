import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { anonymous } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: ["http://localhost:5173", "https://cosplit.xinqi.mu"],
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

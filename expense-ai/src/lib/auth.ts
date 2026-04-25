import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import { findUserByEmail, normalizeEmail } from "@/lib/users";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const isSecureCookie =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXTAUTH_URL?.startsWith("https://") ?? false);

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60, // refresh token/cookie age daily
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: isSecureCookie
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureCookie,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string | null | undefined;
        session.user.email = token.email as string | null | undefined;
        session.user.id = (token.sub ?? token.id) as string;
      }
      return session;
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (account?.provider === "google" && profile?.email) {
        const email = normalizeEmail(String(profile.email));
        const name =
          typeof profile.name === "string" && profile.name
            ? profile.name
            : email.split("@")[0];
        const existingUser = await findUserByEmail(email);
        const dbUser = existingUser
          ? await prisma.user.update({
              where: { id: existingUser.id },
              data: { email, name },
            })
          : await prisma.user.create({
              data: { email, name, password: undefined },
            });
        token.sub = dbUser.id;
        token.id = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name;
        return token;
      }
      if (user) {
        token.id = user.id;
        token.sub = user.id;
      }

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      return token;
    },
  },
};

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { findUserByEmail, normalizeEmail } from "@/lib/users";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// Must match getToken's detection (used by the withAuth middleware), which keys
// off the NEXTAUTH_URL scheme — not NODE_ENV. Dev-over-https would otherwise
// write "next-auth.session-token" while the middleware reads "__Secure-…".
const useSecureCookies =
  process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;

// Local-only login so Google OAuth isn't required for dev testing. Never
// registered in production, so it cannot become a live auth bypass.
const isDevCredentialsEnabled = process.env.NODE_ENV !== "production";
const DEV_LOGIN_PASSWORD = (process.env.DEV_LOGIN_PASSWORD ?? "password").trim();

const devCredentialsProvider = CredentialsProvider({
  id: "dev-credentials",
  name: "Dev Login",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials.password) return null;
    if (credentials.password.trim() !== DEV_LOGIN_PASSWORD) return null;

    const email = normalizeEmail(credentials.email);
    if (!email.includes("@")) return null;

    const name = email.split("@")[0];
    const existingUser = await findUserByEmail(email);
    const dbUser = existingUser
      ? await prisma.user.update({ where: { id: existingUser.id }, data: { name } })
      : await prisma.user.create({ data: { email, name } });

    return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
  },
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
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
    ...(isDevCredentialsEnabled ? [devCredentialsProvider] : []),
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
        token.email = user.email;
        token.name = user.name;
      }

      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      return token;
    },
  },
};

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@split.ai" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          if (!user?.password) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        } catch {
          return null;
        }
      },
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
        const email = String(profile.email).toLowerCase();
        const name =
          typeof profile.name === "string" && profile.name
            ? profile.name
            : email.split("@")[0];
        const dbUser = await prisma.user.upsert({
          where: { email },
          create: { email, name, password: undefined },
          update: { name },
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

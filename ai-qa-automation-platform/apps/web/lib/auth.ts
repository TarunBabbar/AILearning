import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        return { id: credentials.email, email: credentials.email, name: credentials.email.split("@")[0] };
      },
    }),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [GitHubProvider({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET })]
      : []),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    async jwt({ token }) {
      // Every request: resolve the user's membership. If the token carries a
      // stale workspaceId (e.g. DB was reset), self-heal to a valid one.
      const email = token.email ?? "";
      if (!email) return token;

      let dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser) {
        // Token exists but DB user is gone (schema reset) — recreate.
        dbUser = await prisma.user.create({
          data: { email, name: (token.name as string) ?? undefined, provider: "credentials" },
        });
      }

      let member = await prisma.workspaceMember.findFirst({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "asc" },
      });
      if (!member) {
        // User has no workspace (reset or deleted) — create one.
        const ws = await prisma.workspace.create({
          data: { name: `${token.name ?? email.split("@")[0]}'s workspace` },
        });
        member = await prisma.workspaceMember.create({
          data: { workspaceId: ws.id, userId: dbUser.id, role: "owner" },
        });
      }

      // Validate the token's workspaceId still exists; if not, use member's.
      if (token.workspaceId) {
        const wsExists = await prisma.workspace.findUnique({ where: { id: token.workspaceId as string } });
        if (!wsExists) {
          token.workspaceId = member.workspaceId;
        }
      } else {
        token.workspaceId = member.workspaceId;
      }
      token.role = member.role;
      return token;
    },
    async session({ session, token }) {
      session.workspaceId = (token.workspaceId as string) ?? "";
      session.role = (token.role as string) ?? "";
      return session;
    },
  },
  pages: { signIn: "/login" },
};

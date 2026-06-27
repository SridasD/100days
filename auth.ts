import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { userDetails } from "@/lib/db/schema/user";
import { loginSchema } from "@/lib/validations/login";
import { writeAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";
import { authConfig } from "@/auth.config";

const LOCKOUT_THRESHOLD = Number(process.env.ACCOUNT_LOCKOUT_THRESHOLD ?? 5);
const LOCKOUT_MINUTES = Number(process.env.ACCOUNT_LOCKOUT_MINUTES ?? 30);
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 8);

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      loginName: string;
      userName: string;
      designation: string | null;
      roleId: number;
      secId: number;
      deptId: number;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    loginName: string;
    userName: string;
    designation: string | null;
    roleId: number;
    secId: number;
    deptId: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        loginName: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { loginName, password } = parsed.data;

        const [user] = await db
          .select()
          .from(userDetails)
          .where(eq(userDetails.loginName, loginName))
          .limit(1);

        if (!user) {
          await writeAuditLog({
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            outcome: "FAILURE",
            meta: { loginName, reason: "user_not_found" },
          });
          return null;
        }

        // Inactive account
        if (user.status !== 1) {
          await writeAuditLog({
            userId: user.userId,
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            outcome: "FAILURE",
            meta: { reason: "inactive" },
          });
          return null;
        }

        // Lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAuditLog({
            userId: user.userId,
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            outcome: "FAILURE",
            meta: { reason: "locked" },
          });
          return null;
        }

        const ok = user.password
          ? await bcrypt.compare(password, user.password)
          : false;

        if (!ok) {
          const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
          const shouldLock = nextAttempts >= LOCKOUT_THRESHOLD;
          await db
            .update(userDetails)
            .set({
              failedLoginAttempts: nextAttempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : null,
            })
            .where(eq(userDetails.userId, user.userId));

          await writeAuditLog({
            userId: user.userId,
            action: shouldLock
              ? AUDIT_ACTIONS.ACCOUNT_LOCKED
              : AUDIT_ACTIONS.LOGIN_FAILURE,
            outcome: "FAILURE",
            meta: { attempts: nextAttempts },
          });
          return null;
        }

        // Successful login — reset counters
        await db
          .update(userDetails)
          .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLogin: new Date(),
          })
          .where(eq(userDetails.userId, user.userId));

        await writeAuditLog({
          userId: user.userId,
          action: AUDIT_ACTIONS.LOGIN_SUCCESS,
          secId: user.secId ?? null,
        });

        return {
          id: String(user.userId),
          loginName: user.loginName ?? "",
          name: user.userName ?? user.loginName ?? "",
          userName: user.userName ?? user.loginName ?? "",
          designation: user.designation ?? null,
          roleId: user.roleId ?? 0,
          secId: user.secId ?? 0,
          deptId: user.deptId ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.loginName = user.loginName;
        token.userName = user.userName;
        token.designation = user.designation;
        token.roleId = user.roleId;
        token.secId = user.secId;
        token.deptId = user.deptId;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.loginName = token.loginName as string;
        session.user.userName = token.userName as string;
        session.user.designation = (token.designation as string | null) ?? null;
        session.user.roleId = token.roleId as number;
        session.user.secId = token.secId as number;
        session.user.deptId = (token.deptId as number | undefined) ?? 0;
      }
      return session;
    },
  },
});

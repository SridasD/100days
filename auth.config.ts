import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Node.js modules (no bcrypt, no db).
// Used by middleware for JWT session validation only.
// Full auth logic (credentials + db) lives in auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const { pathname } = nextUrl;
      const role = (auth?.user as any)?.roleId as number | undefined;
      const isApiRoute = pathname.startsWith("/api/");
      const hasSessionCookie =
        !!request.cookies.get("__Secure-authjs.session-token") ||
        !!request.cookies.get("authjs.session-token") ||
        !!request.cookies.get("__Secure-next-auth.session-token") ||
        !!request.cookies.get("next-auth.session-token");
      // Edge middleware can occasionally fail to deserialize session on API
      // routes behind certain proxy setups. For APIs, allow cookie-present
      // requests through and let route-level guards enforce auth strictly.
      const isLoggedIn = !!auth?.user || (isApiRoute && hasSessionCookie);
      const method = request.method.toUpperCase();
      const isUnsafeMethod =
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH" ||
        method === "DELETE";
      const isStaticAsset =
        /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$/i.test(pathname);

      // CSRF mitigation: for unsafe API methods, require same-origin when
      // browsers send an Origin header.
      if (isApiRoute && isUnsafeMethod) {
        const origin = request.headers.get("origin");
        if (origin) {
          const proto =
            request.headers.get("x-forwarded-proto") ??
            nextUrl.protocol.replace(":", "");
          const host =
            request.headers.get("x-forwarded-host") ??
            request.headers.get("host");
          const expectedOrigin = host ? `${proto}://${host}` : null;
          if (expectedOrigin && origin !== expectedOrigin) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }

      // OSD-only district detail view and backing API.
      // Keep both legacy singular and canonical plural paths protected.
      if (
        pathname.startsWith("/public/district/") ||
        pathname.startsWith("/public/districts/") ||
        pathname.startsWith("/api/public/district/") ||
        pathname.startsWith("/api/public/districts/")
      ) {
        if (!isLoggedIn) {
          if (isApiRoute) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          return false;
        }
        if (role !== 4) {
          if (isApiRoute) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          return Response.redirect(new URL("/login", nextUrl));
        }
        return true;
      }

      // Public routes — always allowed
      if (
        pathname === "/" ||
        pathname.startsWith("/images") ||
        pathname.startsWith("/public") ||
        pathname.startsWith("/api/uploads") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/public") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        isStaticAsset
      ) {
        return true;
      }

      if (!isLoggedIn) {
        if (isApiRoute) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return false;
      }

      // Role-based redirects (Section 5.4)
      if ((role === 2 || role === 6) && pathname.startsWith("/verify"))
        return Response.redirect(new URL("/officer/projects", nextUrl));
      if (role === 1 && pathname.startsWith("/officer"))
        return Response.redirect(new URL("/verify/projects", nextUrl));
      if (role === 5 && pathname.startsWith("/secretary")) return true;
      if (
        role === 5 &&
        (pathname.startsWith("/officer") ||
          pathname.startsWith("/verify") ||
          pathname.startsWith("/admin"))
      )
        return Response.redirect(new URL("/secretary/dashboard", nextUrl));
      if (
        role === 4 &&
        pathname.startsWith("/admin") &&
        !pathname.startsWith("/admin/osd") &&
        !pathname.startsWith("/admin/projects")
      )
        return Response.redirect(new URL("/admin/osd/dashboard", nextUrl));
      if (role === 3 && pathname.startsWith("/admin/osd"))
        return Response.redirect(new URL("/admin/dashboard", nextUrl));
      if (role !== 3 && role !== 4 && pathname.startsWith("/admin"))
        return Response.redirect(new URL("/login", nextUrl));

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.loginName = (user as any).loginName;
        token.roleId = (user as any).roleId;
        token.secId = (user as any).secId;
        token.deptId = (user as any).deptId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).loginName = token.loginName;
        (session.user as any).roleId = token.roleId;
        (session.user as any).secId = token.secId;
        (session.user as any).deptId = token.deptId;
      }
      return session;
    },
  },
};

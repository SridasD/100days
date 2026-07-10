import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Only authConfig (edge-safe, no bcrypt/db) is used here.
// Full credentials logic lives in auth.ts (Node.js runtime only).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)",
  ],
};

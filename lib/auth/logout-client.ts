"use client";

import { signOut } from "next-auth/react";

export async function logoutWithAuditClient(callbackUrl: string = "/login") {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    if (!response.ok) {
      console.error(
        "[auth][logout] Logout audit request failed:",
        response.status,
      );
    }
  } catch (error) {
    console.error("[auth][logout] Logout audit request failed:", error);
  } finally {
    await signOut({ callbackUrl });
  }
}

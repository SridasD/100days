import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';
import { userDetails } from '@/lib/db/schema/user';
import { writeAudit } from '@/lib/audit/writeAudit';
import { AUDIT_ACTIONS } from '@/lib/db/schema/audit';

export const runtime = 'nodejs';

// ===========================================================================
// In-memory rate limit: 5 attempts per user per 15 minutes.
// Module-scoped Map. Resets on server restart, which is fine — this is a
// belt-and-braces guard against scripted abuse, not the primary defence
// (that's bcrypt cost + the same auth lockout flow used at login).
// ===========================================================================
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
const attempts = new Map<number, number[]>();

function consumeRateLimit(userId: number): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const stamps = (attempts.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_MAX) {
    const retryAfterMs = RATE_WINDOW_MS - (now - stamps[0]!);
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  stamps.push(now);
  attempts.set(userId, stamps);
  return { allowed: true, retryAfterMs: 0 };
}

// ===========================================================================
// Same Zod rules the form uses, re-applied here so the server is the
// authoritative validator. Don't trust the client.
// ===========================================================================
const bodySchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'നിലവിലെ പാസ്‌വേഡ് നൽകുക'),
    newPassword: z
      .string()
      .min(8, 'കുറഞ്ഞത് 8 അക്ഷരങ്ങൾ വേണം')
      .regex(/[A-Z]/, 'ഒരു വലിയ അക്ഷരം ഉൾപ്പെടണം')
      .regex(/[0-9]/, 'ഒരു അക്കം ഉൾപ്പെടണം')
      .regex(/[^A-Za-z0-9]/, 'ഒരു പ്രത്യേക ചിഹ്നം ഉൾപ്പെടണം'),
    confirmPassword: z
      .string()
      .min(1, 'പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'പാസ്‌വേഡുകൾ പൊരുത്തപ്പെടുന്നില്ല',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'പുതിയ പാസ്‌വേഡ് പഴയതിൽ നിന്ന് വ്യത്യസ്തമായിരിക്കണം',
    path: ['newPassword'],
  });

const BCRYPT_COST = 12;

// ===========================================================================
// POST /api/auth/change-password
// ===========================================================================
export async function POST(req: NextRequest) {
  // 1. Session check.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'അനധികൃതം. വീണ്ടും ലോഗിൻ ചെയ്യുക.' },
      { status: 401 },
    );
  }

  const sessionUser = session.user as {
    id?: string;
    loginName?: string;
    roleId?: number;
  };
  const userId = Number(sessionUser.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Bad session' }, { status: 401 });
  }

  // 2. Rate limit.
  const rate = consumeRateLimit(userId);
  if (!rate.allowed) {
    const mins = Math.ceil(rate.retryAfterMs / 60000);
    return NextResponse.json(
      {
        error: `വളരെ കൂടുതൽ ശ്രമങ്ങൾ. ${mins} മിനിറ്റിനു ശേഷം വീണ്ടും ശ്രമിക്കുക.`,
      },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil(rate.retryAfterMs / 1000)),
        },
      },
    );
  }

  // 3. Parse + validate body server-side.
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    // Surface the first field-specific Malayalam message for the toast.
    const firstIssue = parsed.error.issues[0];
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: {
        reason: 'validation',
        field: firstIssue?.path[0] ?? null,
        message: firstIssue?.message ?? null,
        roleId: sessionUser.roleId ?? null,
      },
    });
    return NextResponse.json(
      {
        error: firstIssue?.message ?? 'പാസ്‌വേഡ് ദുർബലമാണ്',
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // 4. Fetch the user row.
  const rows = await db
    .select()
    .from(userDetails)
    .where(eq(userDetails.userId, userId))
    .limit(1);
  const user = rows[0];

  if (!user) {
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: { reason: 'user_not_found' },
    });
    return NextResponse.json(
      { error: 'അക്കൗണ്ട് കണ്ടെത്തിയില്ല.' },
      { status: 403 },
    );
  }

  if (user.status !== 1) {
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: { reason: 'inactive', status: user.status, roleId: user.roleId },
    });
    return NextResponse.json(
      { error: 'അക്കൗണ്ട് സജീവമല്ല. അഡ്മിനെ ബന്ധപ്പെടുക.' },
      { status: 403 },
    );
  }

  // 5. Verify the current password against the stored bcrypt hash.
  const currentOk = user.password
    ? await bcrypt.compare(currentPassword, user.password)
    : false;
  if (!currentOk) {
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: { reason: 'wrong_current_password', roleId: user.roleId },
    });
    return NextResponse.json(
      { error: 'നിലവിലെ പാസ്‌വേഡ് തെറ്റാണ്' },
      { status: 400 },
    );
  }

  // 6. Defence in depth — even though the Zod refine catches it, re-check
  //    the "new ≠ old" rule against the stored hash. Handles the edge case
  //    where the client submitted a different currentPassword string but
  //    the same intended new value as the existing password.
  const sameAsExisting = user.password
    ? await bcrypt.compare(newPassword, user.password)
    : false;
  if (sameAsExisting) {
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: { reason: 'same_as_existing', roleId: user.roleId },
    });
    return NextResponse.json(
      {
        error:
          'പുതിയ പാസ്‌വേഡ് പഴയതിൽ നിന്ന് വ്യത്യസ്തമായിരിക്കണം',
      },
      { status: 400 },
    );
  }

  // 7. Hash the new password and write the row + clear lockout state.
  try {
    const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await db
      .update(userDetails)
      .set({
        password: hash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(userDetails.userId, userId));

    // 8. Reset the rate-limit bucket on success so a legitimate user who
    //    fumbled the current password a few times doesn't get throttled
    //    on the very change that just succeeded.
    attempts.delete(userId);

    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'SUCCESS',
      secId: user.secId ?? null,
      meta: { roleId: user.roleId, loginName: user.loginName },
    });

    return NextResponse.json(
      { message: 'പാസ്‌വേഡ് വിജയകരമായി മാറ്റി' },
      { status: 200 },
    );
  } catch (err) {
    console.error('change-password update failed', err);
    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD_FAILED,
      entity: 'user_details',
      entityId: userId,
      request: req,
      outcome: 'FAILURE',
      meta: { reason: 'db_error' },
    });
    return NextResponse.json(
      { error: 'പാസ്‌വേഡ് മാറ്റാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.' },
      { status: 500 },
    );
  }
}

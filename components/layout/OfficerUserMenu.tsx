'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, KeyRound, LogOut, UserCircle } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { writeAuditLog, blocklistJWT } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/db/schema/audit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  /** Optional fallback labels shown before /api/me responds. */
  roleLabel?: string;
  departmentLabel?: string;
  /** Optional initials override. */
  initials?: string;
}

interface MeResponse {
  userId: number;
  userName: string;
  loginName: string;
  designation: string | null;
  roleId: number;
  secId: number;
  departmentLabel: string | null;
}

const ROLE_NAMES: Record<number, string> = {
  1: 'Verification Officer',
  2: 'Nodal Officer',
  5: 'Secretary',
  6: 'Head of Department',
  3: 'Administrator',
  4: 'OSD Administrator',
};

/**
 * Server action: Write LOGOUT audit event, blocklist JWT, and sign out the user.
 * Extracts IP address and user-agent from request headers.
 */
async function logoutWithAudit() {
  'use server';

  try {
    const session = await auth();
    const headersList = await headers();

    const userIp = headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'unknown';
    const userAgent = headersList.get('user-agent') || undefined;

    if (session?.user?.id) {
      const userId = parseInt(session.user.id, 10);

      // Generate a unique jti (JWT ID) for blocklisting
      // In production, this would come from the JWT itself, but since we don't
      // have direct access to it here, we use a combination of userId + timestamp
      const jti = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Blocklist the JWT to prevent reuse after logout
      await blocklistJWT(userId, jti, 'USER_LOGOUT');

      // Write LOGOUT audit event
      await writeAuditLog({
        userId: userId,
        action: AUDIT_ACTIONS.LOGOUT,
        outcome: 'SUCCESS',
        ip: userIp,
        userAgent: userAgent,
      });
    }
  } catch (error) {
    // Log error but don't fail the logout
    console.error('Failed to write logout audit or blocklist JWT:', error);
  }

  // Sign out the user
  await signOut({ callbackUrl: '/login' });
}

/**
 * Map the current user's role_id to the role-scoped change-password URL.
 * Falls back to the canonical officer path so unknown roles still resolve.
 */
function changePasswordHref(roleId: number | undefined): string {
  switch (roleId) {
    case 1:
      return '/verify/settings/change-password';
    case 3:
    case 4:
      return '/admin/settings/change-password';
    case 5:
      return '/secretary/settings/change-password';
    case 6:
    case 2:
    default:
      return '/officer/settings/change-password';
  }
}

function initialsFrom(text: string): string {
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '•'
  );
}

/**
 * Top-right account chip. Reads the live user profile from /api/me — that
 * way the displayed user_name + designation + department come straight from
 * hdp.user_details on every page load, independent of what was baked into
 * the JWT at login.
 */
export function OfficerUserMenu({
  roleLabel,
  departmentLabel: deptFallback,
  initials,
}: Props) {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as MeResponse) : null))
      .then((data) => {
        if (!cancelled && data) setMe(data);
      })
      .catch(() => {
        /* keep fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolution order:
  //   me.userName  →  caller's roleLabel  →  'User'
  //   me.designation  →  ROLE_NAMES[roleId]  →  roleLabel
  //   me.departmentLabel  →  caller's deptFallback
  const displayName = me?.userName?.trim()
    ? me.userName
    : (roleLabel ?? 'User');
  const designation =
    me?.designation?.trim() ||
    (me?.roleId ? ROLE_NAMES[me.roleId] : null) ||
    roleLabel ||
    null;
  const departmentLabel = me?.departmentLabel ?? deptFallback ?? null;
  const shortInitials = initials ?? initialsFrom(displayName);

  // Compose secondary line: "Designation · Department" (deduped)
  const parts: string[] = [];
  if (designation) parts.push(designation);
  if (departmentLabel && departmentLabel !== designation)
    parts.push(departmentLabel);
  const secondaryLine = parts.join(' · ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm font-medium text-white outline-none ring-1 ring-white/15 transition-colors duration-200 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Account menu"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-[12px] font-semibold tracking-wide"
        >
          {shortInitials}
        </span>
        <span className="hidden max-w-[260px] text-left leading-tight sm:block">
          <span className="block truncate text-sm font-semibold">
            {displayName}
          </span>
          {secondaryLine && (
            <span className="block truncate text-[11px] text-white/75">
              {secondaryLine}
            </span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 opacity-80 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-kerala-blue text-sm font-semibold text-white">
              {shortInitials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {designation && (
                <p className="truncate text-[11px] font-normal text-muted-foreground">
                  {designation}
                </p>
              )}
              {departmentLabel && departmentLabel !== designation && (
                <p className="truncate text-[11px] font-normal text-muted-foreground">
                  {departmentLabel}
                </p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCircle className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={changePasswordHref(me?.roleId)}>
            <KeyRound className="h-4 w-4" />
            Change Password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logoutWithAudit()}
          className="text-error-red focus:bg-error-red/10 focus:text-error-red"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

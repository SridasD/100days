'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    ClipboardList,
    FolderKanban,
    LayoutDashboard,
    Menu,
    Users,
} from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
    children: ReactNode;
}

interface SessionProfile {
    roleId: number;
}

type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
};

const OSD_NAV_ITEMS: NavItem[] = [
    { href: '/admin/osd/dashboard', label: 'Classic Dashboard', icon: LayoutDashboard },
    { href: '/admin/osd/dashboard/v2', label: 'Analytical Dashboard', icon: LayoutDashboard },
    { href: '/admin/osd/analytics/exceptions', label: 'Exception Monitor', icon: ClipboardList },
    { href: '/admin/osd/projects', label: 'Projects', icon: FolderKanban },
    { href: '/admin/osd/reports', label: 'Reports', icon: BarChart3 },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
    { href: '/admin/projects/archive', label: 'Project Archive', icon: FolderKanban },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList },
    { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

function AdminNav({
    closeOnNavigate = false,
    collapsed = false,
    mode = 'sidebar',
}: {
    closeOnNavigate?: boolean;
    collapsed?: boolean;
    mode?: 'sidebar' | 'topbar';
}) {
    const pathname = usePathname();
    const isOsd = pathname.startsWith('/admin/osd');
    const navItems = isOsd ? OSD_NAV_ITEMS : ADMIN_NAV_ITEMS;

    const navClass =
        mode === 'topbar'
            ? 'flex items-center gap-2 overflow-x-auto pb-1'
            : 'space-y-1';

    return (
        <nav className={navClass} aria-label="Admin navigation">
            {navItems.map((item) => {
                const Icon = item.icon;
                const active = isOsd
                    ? item.href === '/admin/osd/dashboard/v2'
                        ? pathname === '/admin/osd/dashboard/v2' || pathname.startsWith('/admin/osd/dashboard/v2/')
                        : item.href === '/admin/osd/dashboard'
                            ? pathname === '/admin/osd/dashboard' && !pathname.startsWith('/admin/osd/dashboard/v2')
                            : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : pathname === item.href ||
                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                const link = (
                    <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={cn(
                            'group flex items-center text-sm font-medium transition-all duration-200',
                            mode === 'topbar'
                                ? 'shrink-0 gap-2 rounded-full border px-3 py-1.5'
                                : 'rounded-lg',
                            mode !== 'topbar' &&
                            (collapsed ? 'justify-center gap-0 px-2 py-2.5' : 'gap-3 px-3 py-2.5'),
                            active
                                ? mode === 'topbar'
                                    ? 'border-kerala-blue bg-kerala-blue text-white shadow-sm'
                                    : 'bg-kerala-blue text-white shadow-sm'
                                : mode === 'topbar'
                                    ? 'border-border bg-background text-muted-foreground hover:border-kerala-blue/40 hover:bg-muted hover:text-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        <Icon className={cn('h-4 w-4', active ? 'text-current' : 'text-muted-foreground group-hover:text-foreground')} />
                        {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                    </Link>
                );

                return closeOnNavigate ? (
                    <SheetClose asChild key={item.href}>
                        {link}
                    </SheetClose>
                ) : (
                    link
                );
            })}
        </nav>
    );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const isOsd = pathname.startsWith('/admin/osd');
    const [profile, setProfile] = useState<SessionProfile | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const roleLabel = isOsd ? 'Executive Administrator' : 'Admin';
    const departmentLabel = isOsd ? 'CMO Executive' : 'CMO';

    useEffect(() => {
        let cancelled = false;

        fetch('/api/me', { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<SessionProfile>;
            })
            .then((data) => {
                if (!cancelled) setProfile(data);
            })
            .catch(() => {
                if (!cancelled) setProfile(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!profile) return;
        if (profile.roleId === 4 && !pathname.startsWith('/admin/osd')) {
            router.replace('/admin/osd/dashboard');
            return;
        }
        if (profile.roleId === 3 && pathname.startsWith('/admin/osd')) {
            router.replace('/admin/dashboard');
        }
    }, [pathname, profile, router]);

    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <KeralaHeader
                homeHref={profile?.roleId === 4 ? '/admin/osd/dashboard' : '/admin/dashboard'}
                right={<OfficerUserMenu roleLabel={roleLabel} departmentLabel={departmentLabel} />}
            />

            <div className={cn('mx-auto flex w-full flex-1 gap-6 px-4 py-6', isOsd ? 'max-w-[1720px]' : 'max-w-[1400px]')}>
                {!isOsd && !sidebarCollapsed ? (
                    <aside className="hidden w-72 shrink-0 lg:block">
                        <div className="sticky top-24 rounded-xl border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Admin Console
                                </p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => setSidebarCollapsed(true)}
                                    aria-label="Collapse sidebar"
                                >
                                    <Menu className="h-4 w-4" />
                                </Button>
                            </div>
                            <AdminNav />
                        </div>
                    </aside>
                ) : null}

                <div className="flex min-w-0 flex-1 flex-col">
                    {!isOsd ? (
                        <div className="mb-3 hidden lg:flex">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2"
                                onClick={() => setSidebarCollapsed((value) => !value)}
                                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                <Menu className="h-4 w-4" />
                                {sidebarCollapsed ? 'Show menu' : 'Hide menu'}
                            </Button>
                        </div>
                    ) : null}

                    {isOsd ? (
                        <div className="mb-4 rounded-xl border bg-background p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Executive Console
                                </p>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    Executive Navigation
                                </span>
                            </div>
                            <AdminNav mode="topbar" />
                        </div>
                    ) : null}

                    <div className={cn('mb-3 lg:hidden', isOsd && 'hidden')}>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Menu className="h-4 w-4" />
                                    Menu
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[290px] p-5 sm:max-w-[290px]">
                                <SheetTitle className="mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                                    Admin Console
                                </SheetTitle>
                                <AdminNav closeOnNavigate />
                                <SheetClose className="sr-only">Close</SheetClose>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <div className={cn('flex-1 rounded-xl border bg-background p-4 shadow-sm md:p-6', isOsd && 'p-3 sm:p-4 md:p-5')}>
                        {children}
                    </div>
                </div>
            </div>

            <SiteFooter />
        </div>
    );
}
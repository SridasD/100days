'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList },
    { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

function AdminNav({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
    const pathname = usePathname();

    return (
        <nav className="space-y-1" aria-label="Admin navigation">
            {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                    pathname === item.href ||
                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                const link = (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                                ? 'bg-kerala-blue text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
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
    return (
        <div className="flex min-h-screen flex-col bg-muted/30">
            <KeralaHeader
                right={<OfficerUserMenu roleLabel="Admin" departmentLabel="CMO" />}
            />

            <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 py-6">
                <aside className="hidden w-72 shrink-0 lg:block">
                    <div className="sticky top-24 rounded-xl border bg-background p-4 shadow-sm">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Admin Console
                        </p>
                        <AdminNav />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="mb-3 lg:hidden">
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

                    <div className="flex-1 rounded-xl border bg-background p-4 shadow-sm md:p-6">
                        {children}
                    </div>
                </div>
            </div>

            <SiteFooter />
        </div>
    );
}
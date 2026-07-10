"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
    { href: "/secretary/dashboard", label: "Dashboard" },
    { href: "/secretary/supporting-dashboard", label: "Co-Implementation Dashboard" },
    { href: "/secretary/departments", label: "Departments" },
    { href: "/secretary/projects", label: "Projects" },
    { href: "/profile", label: "Profile" },
];

export function SecretaryNav() {
    const pathname = usePathname();

    return (
        <nav className="border-b border-slate-200 bg-white/95">
            <div className="container mx-auto px-4 py-2">
                <div className="flex flex-wrap gap-2">
                    {ITEMS.map((item) => {
                        const active = pathname === item.href || (item.href !== "/profile" && pathname.startsWith(item.href + "/"));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition",
                                    active
                                        ? "border-kerala-blue bg-kerala-blue text-white"
                                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}

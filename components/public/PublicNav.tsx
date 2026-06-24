'use client';

/**
 * White sticky public navbar. Logo block on the left, Malayalam tab links
 * in the centre (underline-on-hover, green underline when active), a
 * "Home" ghost button and the official-login pill button on the right.
 * Adds a subtle drop shadow once the page is scrolled.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Home } from 'lucide-react';

interface NavLink {
  href: string;
  labelMal: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/', labelMal: 'മുഖപ്പ്' },
  { href: '/public/projects', labelMal: 'പദ്ധതികൾ' },
  { href: '/public/progress', labelMal: 'പുരോഗതി' },
  { href: '/public/departments', labelMal: 'വകുപ്പുകൾ' },
  { href: '/public/sectors', labelMal: 'മേഖലകൾ' },
  { href: '/public/gallery', labelMal: 'ചിത്രശാല' },
];

export function PublicNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow duration-200 ${
        scrolled ? 'shadow-md' : 'shadow-none'
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* LOGO BLOCK — borderless wordmark, white tile, deep green text */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center leading-none text-hdp-green">
            <span className="text-[28px] font-black leading-none tracking-tight">
              100
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-hdp-green/85">
              Days
            </span>
          </div>
          <div className="hidden h-9 w-px bg-border sm:block" />
          <div className="hidden leading-tight sm:block">
            <p className="font-malayalam text-sm font-bold text-foreground">
              കേരള സർക്കാർ
            </p>
            <p className="font-malayalam text-[11px] text-muted-foreground">
              നൂറുദിന കർമ്മപദ്ധതി
            </p>
          </div>
        </Link>

        {/* CENTER TABS — underline style */}
        <nav className="hidden lg:flex">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative inline-flex items-center px-3 py-5 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? 'text-hdp-green'
                        : 'text-muted-foreground hover:text-hdp-green'
                    }`}
                  >
                    <span className="font-malayalam">{link.labelMal}</span>
                    <span
                      aria-hidden
                      className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-hdp-green transition-transform duration-200 ${
                        active
                          ? 'scale-x-100'
                          : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* RIGHT — CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-hdp-green md:inline-flex"
          >
            <Home className="h-4 w-4" />
            <span className="font-malayalam">മുഖപ്പ്</span>
          </Link>
          <Link
            href="/login"
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-hdp-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-hdp-green-active hover:shadow-md"
          >
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            <span className="font-malayalam">ഔദ്യോഗിക പ്രവേശനം</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

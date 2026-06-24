/**
 * Shared footer — copyright + DUK credit + SDC hosting note.
 * Used on /login and authenticated pages so the brand chrome stays consistent.
 */
export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40 py-6 text-center text-xs text-muted-foreground">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4">
        <img
          src="/images/duk-logo.png"
          alt="Digital University Kerala"
          width={120}
          height={32}
          className="h-8 w-auto object-contain opacity-90"
        />
        <p className="font-medium text-foreground">
          Copyright © Government of Kerala. All Rights Reserved.
        </p>
        <p className="max-w-2xl leading-relaxed">
          Analytics Dashboard: Designed and Developed by Centre for Digital
          Innovation and Product Development, Digital University Kerala
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          Hosted at State Data Center (SDC), DoE&IT, GoK
        </p>
      </div>
    </footer>
  );
}

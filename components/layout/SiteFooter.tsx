import Image from "next/image";

/**
 * Shared footer with government delivery attribution.
 * Kept intentionally simple and compact for official portal usage.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-[#1f5f26]/30">
      <section className="bg-gradient-to-r from-[#2a7a32] via-[#2e7d32] to-[#2f8634] text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-5 px-4 py-8 text-center sm:px-6 md:py-9 lg:px-8">
          <div className="flex shrink-0 items-center justify-center">
            <Image
              src="/images/duk-logo.png"
              alt="Digital University Kerala"
              width={190}
              height={52}
              className="h-10 w-auto rounded-md bg-white/95 px-2 py-1 object-contain"
            />
          </div>

          <div className="max-w-[760px] space-y-1 text-white/95">
            <p className="text-sm font-normal leading-snug md:text-base">Dashboard Designed, Developed and Implemented by</p>
            <p className="text-xs font-normal leading-relaxed md:text-sm">Center for Digital Innovation and Product Development</p>
            <p className="text-xs font-normal leading-relaxed text-white/90">(A CMMI Level 3 Certified Center of Excellence)</p>
            <p className="text-xs font-normal leading-relaxed md:text-sm">Digital University Kerala</p>
          </div>
        </div>
      </section>

      <section className="bg-white/95 py-3">
        <div className="mx-auto w-full max-w-[1440px] px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-slate-600">
            © 2026 Government of Kerala. All rights reserved.
          </p>
        </div>
      </section>
    </footer>
  );
}

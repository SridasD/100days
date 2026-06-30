import Image from "next/image";

/**
 * Shared footer with government delivery attribution.
 * Kept intentionally simple and compact for official portal usage.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-[#1f5f26]/30">
      <section className="bg-gradient-to-r from-[#2a7a32] via-[#2e7d32] to-[#2f8634] text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-8 sm:px-6 md:py-9 lg:flex-row lg:items-center lg:justify-center lg:gap-14 lg:px-8">
          <div className="flex shrink-0 items-center justify-center gap-4">
            <Image
              src="/images/cdipd-logo.png"
              alt="CDIPD"
              width={170}
              height={44}
              className="h-10 w-auto rounded-md bg-white/95 px-2 py-1 object-contain"
            />
            <Image
              src="/images/duk-logo.png"
              alt="Digital University Kerala"
              width={170}
              height={44}
              className="h-10 w-auto rounded-md bg-white/95 px-2 py-1 object-contain"
            />
          </div>

          <div className="max-w-[720px] space-y-1.5 text-center text-sm leading-relaxed text-white/95 lg:text-left">
            <p className="font-medium">
              Designed, Developed and Implemented by{' '}
              <a
                href="https://cdipd.duk.ac.in/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-white underline-offset-2 hover:underline"
              >
                Centre for Digital Innovation and Product Development
              </a>
            </p>
            <p className="font-medium">
              (CDIPD - CMMI level 3 process oriented center)
            </p>
            <p className="font-medium">
              A Centre of Excellence Established by{' '}
              <a
                href="https://duk.ac.in/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-white underline-offset-2 hover:underline"
              >
                Digital University Kerala
              </a>
            </p>
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

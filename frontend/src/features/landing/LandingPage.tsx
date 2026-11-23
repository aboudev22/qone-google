import { QoneBrand } from "../../shared/components/QoneBrand";
import {
  AuthActions,
  Description,
  FooterWordmark,
  GettingStarted,
  HeroSection,
  Navbar,
} from "./components";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-fg focus:bg-canvas focus:px-4 focus:py-2 focus:text-sm"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-canvas/95 px-5 py-3 backdrop-blur lg:hidden">
        <QoneBrand />
        <AuthActions compact />
      </header>

      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-14 lg:px-10 xl:grid-cols-[190px_minmax(0,1fr)_200px] xl:gap-12 2xl:px-14">
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:self-start lg:py-8">
          <div>
            <QoneBrand />
            <div className="mt-12">
              <Navbar />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-faint">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full border border-line-strong"
            />
            v0.1 — en construction
          </div>
        </aside>

        <main id="contenu" className="min-w-0">
          <div className="flex flex-col gap-20 sm:gap-24 lg:gap-28">
            <HeroSection />
            <Description />
            <GettingStarted />
          </div>

          <footer className="mt-20 border-t border-line pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] text-faint">
              <p>© 2026 qone</p>
              <div className="flex gap-5">
                <a href="/login" className="transition-colors hover:text-fg">
                  Connexion
                </a>
                <a href="/register" className="transition-colors hover:text-fg">
                  Créer un compte
                </a>
              </div>
            </div>

            <FooterWordmark />
          </footer>
        </main>

        <aside className="hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:flex-col xl:justify-between xl:self-start xl:py-8">
          <div className="border-t border-line pt-4">
            <p className="text-[11px] text-faint">Accès</p>
            <div className="mt-4">
              <AuthActions />
            </div>
          </div>

          <p className="max-w-[22ch] text-[10px] leading-5 text-faint">
            Un espace unique pour votre équipe, vos clients et vos opérations.
          </p>
        </aside>
      </div>
    </div>
  );
}

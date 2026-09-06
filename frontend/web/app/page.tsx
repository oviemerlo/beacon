import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/helpers/api";
import { SignalPing } from "@/components/SignalPing";

export default async function HomePage() {
  const user = await getCurrentUserOrNull();
  if (user) redirect("/feed");

  return (
    <main className="min-h-screen px-6">
      <header className="max-w-6xl mx-auto py-6 flex items-center justify-between gap-3">
        <a href="/" className="flex min-w-0 items-center gap-2 sm:gap-3 text-signal-400">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-md shrink-0" />
          <span className="font-display text-sm sm:text-lg md:text-2xl font-bold tracking-tight truncate">ECHOTOCROWD</span>
        </a>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <a href="/login" className="whitespace-nowrap px-2 py-1.5 sm:px-4 sm:py-2 rounded-beacon text-xs sm:text-sm text-parchment-300 hover:text-parchment-100 transition-all duration-200">
            Join now
          </a>
          <a href="/login" className="btn-primary whitespace-nowrap px-3 py-1.5 sm:px-6 sm:py-2 text-xs sm:text-sm transition-all duration-200">
            Sign in
          </a>
        </div>
      </header>

      <section className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center pt-8 pb-16">
        <div>
          <div className="mb-5 flex items-center gap-2 text-signal-400 font-mono text-sm uppercase tracking-widest">
            <SignalPing size={8} />
            <span>Now broadcasting nearby</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold max-w-xl leading-[1.05]">
            Find your people, wherever you land.
          </h1>
          <p className="mt-5 max-w-2xl text-parchment-500 text-base leading-relaxed">
            <span className="block">EchoToCrowd connects newcomers, local businesses, and students</span>
            <span className="block">to nearby communities who share your culture, roots, and interests.</span>
          </p>
          <p className="tag-pill tag-pill-active mt-4">
            + Find course mates for assignments & study groups
          </p>
        </div>

        <div className="w-full max-w-sm lg:justify-self-end">
          <div className="card">
            <a href="/login" className="btn-primary w-full inline-block px-8 py-3 text-base text-center transition-all duration-200 transform hover:scale-105 hover:text-lg">
              Get started
            </a>
            <a href="/login" className="btn-secondary w-full inline-block mt-3 px-8 py-3 text-base text-center transition-all duration-200 transform hover:scale-105 hover:text-lg">
              Sign in
            </a>
            <p className="text-parchment-500 text-sm text-center mt-4">
              New to EchoToCrowd?{" "}
              <a href="/login" className="text-signal-400 hover:text-signal-300 font-medium">
                Join now
              </a>
            </p>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto py-8 border-t border-dusk-800 text-parchment-500 text-sm">
        <p>EchoToCrowd — Oakville, Ontario, Canada</p>
        <p>
          Contact:{" "}
          <a href="mailto:info@echotocrowd.com" className="text-signal-400 hover:text-signal-300">
            info@echotocrowd.com
          </a>
        </p>
      </footer>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/helpers/api";
import { SignalPing } from "@/components/SignalPing";

export default async function HomePage() {
  const user = await getCurrentUserOrNull();
  if (user) redirect("/feed");

  return (
    <main className="min-h-screen px-6">
      <header className="max-w-6xl mx-auto py-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 text-signal-400">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-12 w-12 rounded-md" />
          <span className="font-display text-2xl font-bold tracking-tight">ECHOTOCROWD</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/login" className="px-4 py-2 rounded-beacon text-parchment-300 hover:text-parchment-100 transition-all duration-200 transform hover:scale-105 hover:text-base">
            Join now
          </a>
          <a href="/login" className="btn-primary px-6 py-2 text-sm transition-all duration-200 transform hover:scale-105 hover:text-base">
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
          <p className="mt-5 max-w-md text-parchment-500 text-lg">
            EchoToCrowd connects newcomers and local businesses with people nearby who
            share where they&apos;re from.
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
    </main>
  );
}

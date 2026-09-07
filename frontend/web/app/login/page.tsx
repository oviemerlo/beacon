import Link from "next/link";
import { GoogleLoginLink } from "@/components/GoogleLoginLink";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-12 w-12 rounded-md" />
        </div>
        <h1 className="font-display text-2xl font-bold text-center">Sign in to EchoToCrowd</h1>
        <p className="text-parchment-500 text-sm text-center mt-2 mb-6">
          Your identity stays private until you choose to connect.
        </p>

        <GoogleLoginLink next={searchParams.next} />

        {/* Apple Sign-In requires the native SDK / JS SDK for a real popup flow.
            Wire this up with AppleID.auth.signIn() and POST the identity_token
            to /auth/apple/token-exchange via the proxy route. */}
        <button className="btn-secondary w-full flex items-center justify-center gap-2" disabled>
          Continue with Apple (mobile app only for now)
        </button>
        <p className="text-xs text-parchment-500 mt-4 text-center">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-parchment-100">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-parchment-100">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}

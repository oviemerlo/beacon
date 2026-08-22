const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-12 w-12 rounded-md" />
        </div>
        <h1 className="font-display text-2xl font-bold text-center">Sign in to EchoToCrowd</h1>
        <p className="text-parchment-500 text-sm text-center mt-2 mb-6">
          We only use this to verify who you are — never to post on your behalf.
        </p>

        <a href={`${API_URL}/auth/google/login`} className="btn-secondary w-full flex items-center justify-center gap-2 mb-3">
          Continue with Google
        </a>

        {/* Apple Sign-In requires the native SDK / JS SDK for a real popup flow.
            Wire this up with AppleID.auth.signIn() and POST the identity_token
            to /auth/apple/token-exchange via the proxy route. */}
        <button className="btn-secondary w-full flex items-center justify-center gap-2" disabled>
          Continue with Apple (mobile app only for now)
        </button>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { clientFetch } from "@/helpers/client-api";

const DELETE_CONFIRM_MESSAGE =
  "This is permanent. Your profile, echoes, private messages, uploads, and sign-in will be removed. Groups you created stay for remaining members. Replies other people left on your echoes will also be removed.";

export function DeleteAccountButton() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (!window.confirm(`Delete account?\n\n${DELETE_CONFIRM_MESSAGE}`)) return;
    setDeleting(true);
    setError(null);
    try {
      await clientFetch("/users/me", { method: "DELETE" });
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/auth/logout";
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete your account.");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-3">
      {error && <p className="text-rust-400 text-sm mb-3">{error}</p>}
      <button
        type="button"
        onClick={() => void deleteAccount()}
        disabled={deleting}
        className="w-full rounded-beacon bg-rust-400 px-4 py-2.5 font-semibold text-parchment-100 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {deleting ? "Deleting…" : "Delete account"}
      </button>
    </div>
  );
}

"use client";

import { AppNav } from "@/components/AppNav";
import { FollowTagsForm } from "@/components/FollowTagsForm";

export default function FollowTagsPage() {
  return (
    <div className="min-h-screen">
      <AppNav />
      <FollowTagsForm />
    </div>
  );
}

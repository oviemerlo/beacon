import { clientFetch } from "@/helpers/client-api";
import type { School, SchoolVerificationStatus } from "@/types/api";

export async function searchSchools(query: string): Promise<School[]> {
  const q = encodeURIComponent(query);
  return clientFetch<School[]>(`/schools/search?q=${q}`);
}

export async function startVerification(schoolId: number, schoolEmail: string): Promise<void> {
  await clientFetch("/schools/verify/start", {
    method: "POST",
    body: JSON.stringify({ school_id: schoolId, school_email: schoolEmail }),
  });
}

export async function confirmVerification(code: string): Promise<{ school_name: string }> {
  return clientFetch<{ school_name: string }>("/schools/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getVerificationStatus(): Promise<SchoolVerificationStatus> {
  return clientFetch<SchoolVerificationStatus>("/schools/verify/status");
}

export async function getMyCourses(): Promise<string[]> {
  const res = await clientFetch<{ course_codes: string[] }>("/schools/courses");
  return res.course_codes;
}

export async function enrollInCourse(courseCode: string): Promise<void> {
  await clientFetch("/schools/courses", {
    method: "POST",
    body: JSON.stringify({ course_code: courseCode }),
  });
}

export async function unenrollFromCourse(courseCode: string): Promise<void> {
  await clientFetch(`/schools/courses/${encodeURIComponent(courseCode)}`, {
    method: "DELETE",
  });
}

export const COURSE_TAG_MAX_LEN = 8;

export function compactCourseKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeCourseTag(value: string): string {
  const compact = compactCourseKey(value);
  if (!compact) return "";
  const prefix = compact.match(/^[A-Z]+/)?.[0] ?? "";
  const rest = compact.slice(prefix.length);
  return prefix && rest ? `${prefix} ${rest}` : compact;
}

export function trimCourseTag(value: string): string {
  return normalizeCourseTag(value);
}

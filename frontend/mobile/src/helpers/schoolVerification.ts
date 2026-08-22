import { apiFetch } from "../helpers/api";
import type { School, SchoolVerificationStatus } from "../types/api";

export async function searchSchools(query: string): Promise<School[]> {
  const q = encodeURIComponent(query);
  return apiFetch<School[]>(`/schools/search?q=${q}`);
}

export async function startVerification(schoolId: number, schoolEmail: string): Promise<void> {
  await apiFetch("/schools/verify/start", {
    method: "POST",
    body: JSON.stringify({ school_id: schoolId, school_email: schoolEmail }),
  });
}

export async function confirmVerification(code: string): Promise<{ school_name: string }> {
  return apiFetch<{ school_name: string }>("/schools/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getVerificationStatus(): Promise<SchoolVerificationStatus> {
  return apiFetch<SchoolVerificationStatus>("/schools/verify/status");
}

export async function getMyCourses(): Promise<string[]> {
  const res = await apiFetch<{ course_codes: string[] }>("/schools/courses");
  return res.course_codes;
}

export async function enrollInCourse(courseCode: string): Promise<void> {
  await apiFetch("/schools/courses", {
    method: "POST",
    body: JSON.stringify({ course_code: courseCode }),
  });
}

export async function unenrollFromCourse(courseCode: string): Promise<void> {
  await apiFetch(`/schools/courses/${encodeURIComponent(courseCode)}`, {
    method: "DELETE",
  });
}

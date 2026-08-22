"use client";

import { useEffect, useMemo, useState } from "react";

import {
  confirmVerification,
  enrollInCourse,
  getMyCourses,
  getVerificationStatus,
  searchSchools,
  startVerification,
  unenrollFromCourse,
} from "@/helpers/school-verification";
import type { School } from "@/types/api";

type Phase = "idle" | "searching" | "school_selected" | "code_sent" | "verified";

export function SchoolVerification() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolEmail, setSchoolEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifiedSchoolName, setVerifiedSchoolName] = useState<string | null>(null);
  const [courses, setCourses] = useState<string[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSendCode = useMemo(() => selectedSchool && schoolEmail.trim().length > 0, [selectedSchool, schoolEmail]);

  useEffect(() => {
    getVerificationStatus()
      .then((status) => {
        if (status.verified && status.school_name) {
          setVerifiedSchoolName(status.school_name);
          getMyCourses().then(setCourses).catch(() => setCourses([]));
          setPhase("verified");
          return;
        }
        setPhase("idle");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load school verification"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (phase !== "searching") return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      searchSchools(q)
        .then((schools) => {
          if (active) setMatches(schools);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Couldn't search schools");
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phase, query]);

  async function sendCode() {
    if (!selectedSchool) return;
    setSubmitting(true);
    setError(null);
    try {
      await startVerification(selectedSchool.id, schoolEmail.trim());
      setPhase("code_sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send verification code");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmVerification(code.trim());
      setVerifiedSchoolName(result.school_name);
      const enrolled = await getMyCourses();
      setCourses(enrolled);
      setPhase("verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify code");
    } finally {
      setSubmitting(false);
    }
  }

  function normalizeCourseCode(value: string): string {
    return value.trim().replace(/\s+/g, " ").toUpperCase();
  }

  async function addCourse() {
    const normalized = normalizeCourseCode(courseInput);
    if (!normalized) return;
    setSubmitting(true);
    setError(null);
    try {
      await enrollInCourse(normalized);
      setCourseInput("");
      setCourses((prev) => (prev.includes(normalized) ? prev : [...prev, normalized].sort()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add course");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCourse(codeToRemove: string) {
    setSubmitting(true);
    setError(null);
    try {
      await unenrollFromCourse(codeToRemove);
      setCourses((prev) => prev.filter((item) => item !== codeToRemove));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove course");
    } finally {
      setSubmitting(false);
    }
  }

  function selectSchool(school: School) {
    setSelectedSchool(school);
    setMatches([]);
    setQuery(school.name);
    setPhase("school_selected");
    setError(null);
  }

  if (loading) {
    return <p className="text-parchment-500 font-mono text-sm">Loading school verification…</p>;
  }

  return (
    <div>
      {phase === "verified" ? (
        <div className="space-y-2">
          <div className="tag-pill border-moss-500 bg-moss-500/10 text-moss-500">
            <span>Verified</span>
            <span>{verifiedSchoolName ?? "School"}</span>
            <span aria-hidden>✓</span>
          </div>
          <div>
            <p className="text-parchment-500 text-xs font-mono mb-2">My courses</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="input-field text-sm py-2"
                placeholder="e.g. CHM123"
                value={courseInput}
                onChange={(e) => setCourseInput(e.target.value)}
              />
              <button className="btn-primary text-sm" onClick={addCourse} disabled={submitting || !normalizeCourseCode(courseInput)}>
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => (
                <button key={course} className="tag-pill" onClick={() => removeCourse(course)} disabled={submitting}>
                  {course}
                  <span aria-hidden>x</span>
                </button>
              ))}
              {courses.length === 0 && <p className="text-parchment-500 text-xs">No courses added yet.</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {phase === "idle" && (
            <button className="btn-secondary text-sm" onClick={() => setPhase("searching")}>
              Verify your school
            </button>
          )}

          {(phase === "searching" || phase === "school_selected" || phase === "code_sent") && (
            <div className="space-y-2">
              <input
                type="text"
                className="input-field text-sm py-2"
                placeholder="Search school"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (phase !== "searching") setPhase("searching");
                }}
              />
              {phase === "searching" && (
                <>
                  {query.trim().length < 2 ? (
                    <p className="text-parchment-500 text-xs">Type at least 2 characters to search.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {matches.map((school) => (
                        <button key={school.id} className="tag-pill" onClick={() => selectSchool(school)}>
                          {school.name}
                          {school.country ? ` (${school.country})` : ""}
                        </button>
                      ))}
                      {matches.length === 0 && <p className="text-parchment-500 text-xs">No schools found.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {(phase === "school_selected" || phase === "code_sent") && selectedSchool && (
            <div className="mt-2 space-y-2">
              <div className="tag-pill tag-pill-active">
                {selectedSchool.name}
                {selectedSchool.country ? ` (${selectedSchool.country})` : ""}
              </div>
              <input
                type="email"
                className="input-field text-sm py-2"
                placeholder="School email"
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                <button className="btn-primary text-sm" disabled={!canSendCode || submitting} onClick={sendCode}>
                  {submitting && phase !== "code_sent" ? "Sending…" : "Send code"}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setPhase("searching")} disabled={submitting}>
                  Change school
                </button>
              </div>
            </div>
          )}

          {phase === "code_sent" && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                className="input-field text-sm py-2"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <div className="flex gap-2 flex-wrap">
                <button className="btn-primary text-sm" onClick={verifyCode} disabled={submitting || code.trim().length !== 6}>
                  {submitting ? "Verifying…" : "Verify"}
                </button>
                <button className="btn-secondary text-sm" onClick={sendCode} disabled={submitting || !canSendCode}>
                  Resend code
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

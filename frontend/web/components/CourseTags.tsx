"use client";

import { useEffect, useState } from "react";

import {
  COURSE_TAG_MAX_LEN,
  compactCourseKey,
  enrollInCourse,
  getMyCourses,
  trimCourseTag,
  unenrollFromCourse,
} from "@/helpers/school-verification";

export function CourseTags() {
  const [courses, setCourses] = useState<string[]>([]);
  const [courseInput, setCourseInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextCourse = trimCourseTag(courseInput);
  const compact = compactCourseKey(courseInput);
  const canAdd = compact.length > 0 && compact.length <= COURSE_TAG_MAX_LEN && !submitting;

  useEffect(() => {
    getMyCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  async function addCourse() {
    if (!canAdd) return;
    setSubmitting(true);
    setError(null);
    try {
      await enrollInCourse(nextCourse);
      setCourseInput("");
      setCourses((prev) => (prev.includes(nextCourse) ? prev : [...prev, nextCourse]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add course tag");
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
      setError(err instanceof Error ? err.message : "Couldn't remove course tag");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          className="input-field text-sm py-2"
          placeholder="e.g. CS101"
          value={courseInput}
          maxLength={COURSE_TAG_MAX_LEN * 2}
          onChange={(e) => setCourseInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCourse();
            }
          }}
        />
        <button type="button" className="btn-primary text-sm" onClick={addCourse} disabled={!canAdd}>
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {courses.map((course) => (
          <button key={course} type="button" className="tag-pill" onClick={() => removeCourse(course)} disabled={submitting}>
            {course}
            <span aria-hidden>x</span>
          </button>
        ))}
        {courses.length === 0 && <p className="text-parchment-500 text-xs">No course tags yet.</p>}
      </div>
      {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

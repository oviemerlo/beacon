import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  COURSE_TAG_MAX_LEN,
  compactCourseKey,
  enrollInCourse,
  getMyCourses,
  trimCourseTag,
  unenrollFromCourse,
} from "../helpers/schoolVerification";
import { colors, radii } from "../theme/tokens";

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
    <View>
      <View style={styles.actionRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="e.g. CS101"
          placeholderTextColor={colors.parchment500}
          value={courseInput}
          onChangeText={setCourseInput}
          maxLength={COURSE_TAG_MAX_LEN * 2}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={addCourse}
        />
        <Pressable style={[styles.primaryButton, !canAdd && styles.disabled]} onPress={addCourse} disabled={!canAdd}>
          <Text style={styles.primaryButtonText}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.pillRow}>
        {courses.map((course) => (
          <Pressable key={course} style={styles.pill} onPress={() => removeCourse(course)} disabled={submitting}>
            <Text style={styles.pillText}>{course} x</Text>
          </Pressable>
        ))}
        {courses.length === 0 && <Text style={styles.hint}>No course tags yet.</Text>}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  hint: { color: colors.parchment500, fontSize: 11 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  pill: {
    borderColor: colors.dusk600,
    borderWidth: 1,
    backgroundColor: colors.dusk800,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 12 },
  disabled: { opacity: 0.4 },
  error: { color: colors.rust400, fontSize: 12, marginTop: 8 },
});

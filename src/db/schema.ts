import { pgTable, uuid, varchar, timestamp, boolean, jsonb, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['student', 'admin']);
export const gradeLevelEnum = pgEnum('grade_level', ['2nd_sec', '3rd_sec']);
export const platformEnum = pgEnum('platform', ['youtube', 'vimeo']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: roleEnum('role').default('student').notNull(),
  gradeLevel: gradeLevelEnum('grade_level'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lessons = pgTable('lessons', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  gradeLevel: gradeLevelEnum('grade_level').notNull(),
  platform: platformEnum('platform').notNull(),
  videoUrl: varchar('video_url', { length: 255 }).notNull(),
  isFree: boolean('is_free').default(false).notNull(),
  isHidden: boolean('is_hidden').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const quizzes = pgTable('quizzes', {
  id: uuid('id').defaultRandom().primaryKey(),
  lessonId: uuid('lesson_id').references(() => lessons.id).notNull(),
  questions: jsonb('questions').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const codes = pgTable('codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  codeString: varchar('code_string', { length: 255 }).notNull().unique(),
  isUsed: boolean('is_used').default(false).notNull(),
  usedBy: uuid('used_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentLessonAccess = pgTable('student_lesson_access', {
  userId: uuid('user_id').references(() => users.id).notNull(),
  lessonId: uuid('lesson_id').references(() => lessons.id).notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  quizPassed: boolean('quiz_passed').default(false).notNull(),
  quizExempt: boolean('quiz_exempt').default(false).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.lessonId] }),
  };
});


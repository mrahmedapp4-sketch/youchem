import fs from 'fs';
import path from 'path';

// Simple file-backed JSON data store. Replaces the Postgres/Drizzle layer.
// All lessons, quizzes, codes, users and student-lesson access records live
// in a single JSON file on disk. Good enough for this app's scale; every
// read/write goes through an in-memory cache that is persisted synchronously
// so we never serve stale data across requests.

export interface DbUser {
  id: string;
  googleId?: string;
  name: string;
  email: string;
  picture?: string;
  phone?: string;
  guardianPhone?: string;
  school?: string;
  role: 'student' | 'admin';
  gradeLevel?: '2nd_sec' | '3rd_sec' | null;
  createdAt: string;
  blocked?: boolean;
  /** Stable browser/device identifier used for the extra device-ban layer. */
  deviceId?: string | null;
  /** Token that must match the one in the student's JWT cookie.
   *  Cleared on logout so the student can log in again from any device. */
  activeSessionToken?: string | null;
  /** ISO timestamp when the current session expires (mirrors JWT expiry).
   *  A session past this date is treated as expired and allows a new login. */
  sessionExpiresAt?: string | null;
}

export interface DbLesson {
  id: string;
  title: string;
  gradeLevel: '2nd_sec' | '3rd_sec';
  platform: 'youtube' | 'vimeo' | 'bunny';
  videoUrl: string;
  /** Optional Bunny playback segment to skip for students and teacher previews. */
  skipFromSeconds?: number | null;
  skipToSeconds?: number | null;
  isFree: boolean;
  isHidden: boolean;
  createdAt: string;
}

export interface DbQuiz {
  id: string;
  lessonId: string;
  questions: any[];
  examDurationMinutes?: number; // 0 or undefined = no time limit
  createdAt: string;
}

export interface DbCode {
  id: string;
  codeString: string;
  isUsed: boolean;
  usedBy?: string | null;
  lessonId?: string; // which exam/lesson this code unlocks
  createdAt: string;
}

export interface DbStudentLessonAccess {
  userId: string;
  lessonId: string;
  unlockedAt: string;
  quizPassed: boolean;
  quizExempt: boolean;
  // Persist the student's latest quiz attempt so the result can be shown
  // again whenever they revisit the lesson, not just right after submitting.
  quizScore?: number;
  quizTotal?: number;
  quizResults?: Array<{ question: string; studentAnswer: string | null; correctAnswer: string; isCorrect: boolean }>;
  // Minutes the student spent on the lesson viewing page (incremented by heartbeat)
  viewingMinutes?: number;
  // True when the student submitted the quiz and scored < 5/10 — the lesson
  // is locked until the teacher exempts them (quizExempt) or they retake and pass.
  lessonLocked?: boolean;
  // How many times the student has attempted the quiz
  quizAttempts?: number;
}

// A homework is a PDF the teacher publishes for a lesson, plus a bubble-sheet
// answer key (one letter per question number). Students solve the PDF on
// paper, then pick their answer per question number on the platform.
export interface DbHomework {
  id: string;
  title: string;
  gradeLevel: '2nd_sec' | '3rd_sec';
  lessonId?: string; // kept optional for old records
  pdfUrl: string;
  pdfFileName: string;
  numQuestions: number;
  answerKey: string[]; // e.g. ['A', 'C', 'B', ...], one entry per question
  createdAt: string;
}

export interface DbHomeworkSubmission {
  id: string;
  userId: string;
  homeworkId: string;
  lessonId?: string; // optional — kept for old records
  answers: string[];
  score: number;
  total: number;
  createdAt: string;
}

// A manually graded exam entered by the teacher. Scores are always out of 60
// and are kept separate from the automatic lesson quizzes.
export interface DbManualExamGrade {
  id: string;
  studentId: string;
  examName: string;
  score: number;
  maxScore: 60;
  percentage: number;
  confirmed: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface DbSettings {
  id: string; // always 'main'
  teacherPasswordHash?: string;
  /** Random token embedded in the teacher JWT and stored here.
   *  Cleared on logout so stolen cookies are invalidated server-side. */
  activeTeacherToken?: string | null;
  /** Device identifiers that may not authenticate, even if their old account is deleted. */
  blockedDeviceIds?: string[];
  /** Maximum total size in MB allowed for teacher-uploaded files. Default: 500. */
  filesStorageLimitMB?: number;
  /** Secret token used to authenticate the public /api/public/students endpoint. */
  apiKey?: string;
}

// A file the teacher uploads for students to download.
export interface DbFile {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  gradeLevel: '2nd_sec' | '3rd_sec' | 'all';
  uploadedAt: string;
}

interface DBShape {
  users: DbUser[];
  lessons: DbLesson[];
  quizzes: DbQuiz[];
  codes: DbCode[];
  studentLessonAccess: DbStudentLessonAccess[];
  homeworks: DbHomework[];
  homeworkSubmissions: DbHomeworkSubmission[];
  manualExamGrades: DbManualExamGrade[];
  settings: DbSettings[];
  files: DbFile[];
}

// Allow overriding the data directory via env var so it can be pointed at a
// mounted persistent volume (e.g. Railway) regardless of the process cwd.
// Priority: RAILWAY_VOLUME_MOUNT_PATH (set automatically by Railway when a
// Volume is attached) → DATA_DIR (manual override) → ./data next to the binary.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
console.log(`[jsonStore] Using data directory: ${DATA_DIR}`);

const emptyData = (): DBShape => ({
  users: [],
  lessons: [],
  quizzes: [],
  codes: [],
  studentLessonAccess: [],
  homeworks: [],
  homeworkSubmissions: [],
  manualExamGrades: [],
  settings: [],
  files: [],
});

let cache: DBShape | null = null;

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData(), null, 2));
  }
}

function load(): DBShape {
  if (cache) return cache;
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  let parsed: Partial<DBShape> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  cache = { ...emptyData(), ...parsed };
  return cache;
}

function persist() {
  if (!cache) return;
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

type TableName = keyof DBShape;

export const jsonDb = {
  getAll<T extends TableName>(table: T): DBShape[T] {
    return load()[table];
  },
  find<T extends TableName>(table: T, predicate: (item: any) => boolean): any {
    return (load()[table] as any[]).find(predicate);
  },
  filter<T extends TableName>(table: T, predicate: (item: any) => boolean): any[] {
    return (load()[table] as any[]).filter(predicate);
  },
  insert<T extends TableName>(table: T, record: any): any {
    const data = load();
    (data[table] as any[]).push(record);
    persist();
    return record;
  },
  update<T extends TableName>(table: T, predicate: (item: any) => boolean, updates: any): any {
    const data = load();
    let updated: any = null;
    (data as any)[table] = (data[table] as any[]).map((item: any) => {
      if (predicate(item)) {
        updated = { ...item, ...updates };
        return updated;
      }
      return item;
    });
    persist();
    return updated;
  },
  remove<T extends TableName>(table: T, predicate: (item: any) => boolean): boolean {
    const data = load();
    const before = (data[table] as any[]).length;
    (data as any)[table] = (data[table] as any[]).filter((item: any) => !predicate(item));
    persist();
    return before !== (data[table] as any[]).length;
  },
};

export const newId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

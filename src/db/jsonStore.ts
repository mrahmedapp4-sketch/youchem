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
  phone?: string;
  school?: string;
  role: 'student' | 'admin';
  gradeLevel?: '2nd_sec' | '3rd_sec' | null;
  createdAt: string;
}

export interface DbLesson {
  id: string;
  title: string;
  gradeLevel: '2nd_sec' | '3rd_sec';
  platform: 'youtube' | 'vimeo';
  videoUrl: string;
  isFree: boolean;
  isHidden: boolean;
  createdAt: string;
}

export interface DbQuiz {
  id: string;
  lessonId: string;
  questions: any[];
  createdAt: string;
}

export interface DbCode {
  id: string;
  codeString: string;
  isUsed: boolean;
  usedBy?: string | null;
  createdAt: string;
}

export interface DbStudentLessonAccess {
  userId: string;
  lessonId: string;
  unlockedAt: string;
  quizPassed: boolean;
  quizExempt: boolean;
}

interface DBShape {
  users: DbUser[];
  lessons: DbLesson[];
  quizzes: DbQuiz[];
  codes: DbCode[];
  studentLessonAccess: DbStudentLessonAccess[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const emptyData = (): DBShape => ({
  users: [],
  lessons: [],
  quizzes: [],
  codes: [],
  studentLessonAccess: [],
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

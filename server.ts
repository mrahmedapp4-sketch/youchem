import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer-core';

// Resolve the real Chromium ELF binary at startup.
// On Replit/NixOS the `chromium` command is a bash wrapper script, not the
// actual binary. Puppeteer-core checks the file header and rejects scripts,
// so we must find the ELF. Strategy:
//   1. CHROMIUM_PATH env var override (fastest)
//   2. Read the wrapper script pointed to by `which chromium` and extract the
//      `exec "..."` line — that's always the real binary path.
//   3. Fallback: /usr/bin/chromium (non-Nix systems)
const CHROMIUM_PATH: string = (() => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const wrapper = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null')
      .toString().trim();
    if (wrapper) {
      const contents = fs.readFileSync(wrapper, 'utf8');
      // The wrapper ends with: exec "/nix/store/.../chromium"  ...flags... "$@"
      const m = contents.match(/^exec\s+"([^"]+)"/m);
      if (m && m[1] && fs.existsSync(m[1])) return m[1];
    }
  } catch {}
  return '/usr/bin/chromium';
})();
console.log(`[server] Chromium path: ${CHROMIUM_PATH}`);
import {
  jsonDb,
  newId,
  DbUser,
  DbSettings,
  DbLesson,
  DbQuiz,
  DbCode,
  DbStudentLessonAccess,
  DbHomework,
  DbHomeworkSubmission,
  DbFile,
  DbManualExamGrade,
} from './src/db/jsonStore.ts';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = express();
const PORT = process.env.PORT || 5000;

// JWT_SECRET falls back to SESSION_SECRET (a real managed secret) so tokens
// can never be forged using a hardcoded, publicly-visible default.
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET or SESSION_SECRET must be set to sign auth tokens.');
}

// Teacher login password. Fixed in source per explicit request so it no
// longer depends on a TEACHER_PASSWORD environment variable/secret being set
// on every deployment target (Replit, Railway, etc.).
const TEACHER_PASSWORD = 'port5';
const teacherPasswordHashPromise = bcrypt.hash(TEACHER_PASSWORD, 10);

// Used to verify the Google ID token returned by the frontend Firebase sign-in.
// This is the public OAuth web client ID Firebase generated for this project
// (not a secret — it is the expected audience of the token, same as any OAuth client id).
const GOOGLE_CLIENT_ID = firebaseConfig.oAuthClientId;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
// Quiz questions can include base64-encoded images, so raise the default 100kb JSON limit.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// Lightweight health-check endpoint for Railway (and any other platform).
// Registered before DB access so it responds 200 immediately even while the
// JSON store is still initialising on a cold start.
app.get('/health', (_req, res) => res.json({ ok: true }));

// Homework PDFs are stored on disk under data/uploads (gitignored, contains
// no student PII by itself) and served back as static files.
// Same priority as jsonStore.ts: RAILWAY_VOLUME_MOUNT_PATH → DATA_DIR → ./data
const DATA_ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : process.env.NODE_ENV === 'production'
    ? '/app/data'
    : path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads', 'homeworks');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
console.log(`[server] Using uploads directory: ${UPLOADS_DIR}`);

const FILES_DIR = path.join(DATA_ROOT, 'uploads', 'files');
fs.mkdirSync(FILES_DIR, { recursive: true });

// Student PDF files – saved on first registration, overwritten on each download
const STUDENT_PDFS_DIR = path.join(DATA_ROOT, 'student-pdfs');
fs.mkdirSync(STUDENT_PDFS_DIR, { recursive: true });

// Pre-load brand images as base64 once at startup (avoids repeated disk reads)
const _logoPath  = path.join(process.cwd(), 'public', 'logo.png');
const _stampPath = path.join(process.cwd(), 'attached_assets', 'image_1784762402890.png');
const _signPath  = path.join(process.cwd(), 'attached_assets', 'Sign_1784906969294.png');
const LOGO_B64   = fs.existsSync(_logoPath)  ? `data:image/png;base64,${fs.readFileSync(_logoPath).toString('base64')}`  : '';
const STAMP_B64  = fs.existsSync(_stampPath) ? `data:image/png;base64,${fs.readFileSync(_stampPath).toString('base64')}` : '';
const SIGN_B64   = fs.existsSync(_signPath)  ? `data:image/png;base64,${fs.readFileSync(_signPath).toString('base64')}`  : '';
console.log(`[server] Logo: ${LOGO_B64 ? 'yes' : 'NO'}, Stamp: ${STAMP_B64 ? 'yes' : 'NO'}, Sign: ${SIGN_B64 ? 'yes' : 'NO'}`);

// The browser HTML report uses normal same-origin image URLs. This avoids
// making the report depend on inline data URLs or the PDF renderer.
app.get('/report-stamp.png', (_req, res) => {
  res.type('png').set('Cache-Control', 'public, max-age=3600').sendFile(_stampPath);
});
app.get('/report-signature.png', (_req, res) => {
  res.type('png').set('Cache-Control', 'public, max-age=3600').sendFile(_signPath);
});

// Homework PDFs require authentication — no unauthenticated static serving.
// Both students and teachers can fetch them; the route checks either cookie.
app.get('/uploads/homeworks/:filename', (req, res, next) => {
  // Try student auth first, then teacher auth; reject if neither passes.
  const studentToken = req.cookies.student_token;
  const teacherToken = req.cookies.teacher_token;
  let authorized = false;
  if (studentToken) {
    try {
      const decoded = jwt.verify(studentToken, JWT_SECRET) as any;
      if (decoded.role === 'student') {
        const user = jsonDb.find('users', (u: DbUser) => u.id === decoded.studentId);
        if (
          user &&
          !user.blocked &&
          user.activeSessionToken &&
          decoded.sessionToken === user.activeSessionToken &&
          (!user.deviceId || decoded.deviceId === user.deviceId)
        ) {
          authorized = true;
        }
      }
    } catch { /* invalid student token */ }
  }
  if (!authorized && teacherToken) {
    try {
      const decoded = jwt.verify(teacherToken, JWT_SECRET) as any;
      if (decoded.role === 'teacher') {
        const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
        if (settings?.activeTeacherToken && decoded.teacherSessionToken === settings.activeTeacherToken) {
          authorized = true;
        }
      }
    } catch { /* invalid teacher token */ }
  }
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
  const filename = path.basename(req.params.filename); // prevent path traversal
  res.sendFile(path.join(UPLOADS_DIR, filename));
});

const homeworkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${newId()}.pdf`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('يجب أن يكون الملف بصيغة PDF'));
    cb(null, true);
  },
});

// Serve teacher-uploaded files (authenticated + grade-scoped for students)
app.get('/uploads/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal

  // Resolve the DbFile record — required for grade authorization.
  const fileRecord = jsonDb.find('files', (f: DbFile) => path.basename(f.fileUrl) === filename);
  if (!fileRecord) return res.status(404).json({ error: 'Not found' });

  const studentToken = req.cookies.student_token;
  const teacherToken = req.cookies.teacher_token;

  // Try teacher auth first — teachers can access any file.
  if (teacherToken) {
    try {
      const decoded = jwt.verify(teacherToken, JWT_SECRET) as any;
      if (decoded.role === 'teacher') {
        const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
        if (settings?.activeTeacherToken && decoded.teacherSessionToken === settings.activeTeacherToken) {
          return res.sendFile(path.join(FILES_DIR, filename));
        }
      }
    } catch { /* invalid token */ }
  }

  // Try student auth — must be valid session AND grade must match.
  if (studentToken) {
    try {
      const decoded = jwt.verify(studentToken, JWT_SECRET) as any;
      if (decoded.role === 'student') {
        const user = jsonDb.find('users', (u: DbUser) => u.id === decoded.studentId);
        const validSession =
          user &&
          !user.blocked &&
          user.activeSessionToken &&
          decoded.sessionToken === user.activeSessionToken &&
          (!user.deviceId || decoded.deviceId === user.deviceId);
        if (validSession) {
          // Enforce grade-level access: 'all' files are visible to everyone;
          // grade-specific files are only served to students of that grade.
          const gradeMatch =
            fileRecord.gradeLevel === 'all' ||
            fileRecord.gradeLevel === user.gradeLevel;
          if (gradeMatch) return res.sendFile(path.join(FILES_DIR, filename));
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    } catch { /* invalid token */ }
  }

  return res.status(401).json({ error: 'Unauthorized' });
});

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${newId()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Shared cookie options ──────────────────────────────────────────────────────
// secure:true is set in production so cookies are only sent over HTTPS.
// sameSite:lax prevents CSRF while still allowing normal navigation.
const COOKIE_OPTS: express.CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

// Authentication Middleware
const authenticateTeacher = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.teacher_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'teacher') throw new Error('bad role');
    // Server-side session check: if teacher logged out, stored token is null
    // and any lingering cookie (even a stolen one) is immediately rejected.
    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (!settings?.activeTeacherToken || decoded.teacherSessionToken !== settings.activeTeacherToken) {
      res.clearCookie('teacher_token', COOKIE_OPTS);
      return res.status(401).json({ error: 'SESSION_EXPIRED' });
    }
    next();
  } catch (err) {
    res.clearCookie('teacher_token', COOKIE_OPTS);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateStudent = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.student_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'student') throw new Error('bad role');

    // ── Pending (pre-registration) token ──────────────────────────────────
    // Issued for new students who have verified with Google but have not yet
    // submitted their profile form. No DB record exists for them yet.
    if (decoded.pending === true) {
      (req as any).pendingGoogle = {
        googleId: decoded.googleId,
        email:    decoded.email,
        name:     decoded.name || '',
        picture:  decoded.picture || '',
        deviceId: decoded.deviceId || '',
      };
      return next();
    }

    const user = jsonDb.find('users', (u: DbUser) => u.id === decoded.studentId);
    if (!user) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (user.blocked) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(403).json({ error: 'تم حظر هذا الحساب من الدخول إلى المنصة.' });
    }
    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (decoded.deviceId && settings?.blockedDeviceIds?.includes(decoded.deviceId)) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(403).json({ error: 'تم حظر هذا الجهاز من الدخول إلى المنصة.' });
    }
    if (user.deviceId && decoded.deviceId !== user.deviceId) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(401).json({ error: 'DEVICE_MISMATCH' });
    }
    // ── Single-device enforcement ──────────────────────────────────────────
    // The JWT must carry a sessionToken that exactly matches what is stored
    // in the DB. A missing activeSessionToken (after logout) or a mismatch
    // (another device logged in) both result in immediate rejection so that
    // stale cookies can never be reused after logout.
    if (!user.activeSessionToken || decoded.sessionToken !== user.activeSessionToken) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(401).json({ error: 'SESSION_CONFLICT' });
    }
    (req as any).studentId = decoded.studentId;
    next();
  } catch (err) {
    res.clearCookie('student_token', COOKIE_OPTS);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const getStudentProfileErrors = (profile: {
  name?: unknown;
  phone?: unknown;
  guardianPhone?: unknown;
  school?: unknown;
  gradeLevel?: unknown;
}): Record<string, string> => {
  const errors: Record<string, string> = {};
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const phone = normalizeArabicDigits(typeof profile.phone === 'string' ? profile.phone.trim() : '');
  const guardianPhone = normalizeArabicDigits(typeof profile.guardianPhone === 'string' ? profile.guardianPhone.trim() : '');
  const school = typeof profile.school === 'string' ? profile.school.trim() : '';
  const letterCount = Array.from(name).filter((character) => /\p{L}/u.test(character)).length;

  if (letterCount < 8 || name === 'طالب') {
    errors.name = 'الاسم لازم يكون 8 حروف على الأقل';
  }
  if (!/^01\d{9}$/.test(phone)) {
    errors.phone = 'رقم الطالب لازم يبدأ بـ 01 ويكون 11 رقم';
  }
  if (!/^01\d{9}$/.test(guardianPhone)) {
    errors.guardianPhone = 'رقم ولي الأمر لازم يبدأ بـ 01 ويكون 11 رقم';
  }
  if (!school) {
    errors.school = 'اكتب اسم المدرسة';
  }
  if (profile.gradeLevel !== '2nd_sec' && profile.gradeLevel !== '3rd_sec') {
    errors.gradeLevel = 'اختار الصف الدراسي';
  }

  return errors;
};

const normalizeArabicDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

const isValidDeviceId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);

const getMissingStudentProfileFields = (user: DbUser): string[] => {
  return Object.keys(getStudentProfileErrors(user));
};

const requireCompleteStudentProfile = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const studentId = (req as any).studentId;
  const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const profileErrors = getStudentProfileErrors(user);
  if (Object.keys(profileErrors).length > 0) {
    return res.status(403).json({
      error: 'PROFILE_INCOMPLETE',
      needsProfile: true,
      missingFields: Object.keys(profileErrors),
      profileErrors,
    });
  }
  next();
};

// --- TEACHER API ---
app.post('/api/teacher/login', async (req, res) => {
  const { password } = req.body;
  // Use stored hash if teacher changed their password, otherwise fall back to default.
  const storedSettings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
  const hash = storedSettings?.teacherPasswordHash ?? (await teacherPasswordHashPromise);
  const isMatch = typeof password === 'string' && await bcrypt.compare(password, hash);
  if (isMatch) {
    // Generate a server-side session token so logout actually invalidates
    // the cookie even if it was copied or stolen.
    const teacherSessionToken = randomBytes(32).toString('hex');
    const token = jwt.sign({ role: 'teacher', teacherSessionToken }, JWT_SECRET, { expiresIn: '1d' });
    if (storedSettings) {
      jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { activeTeacherToken: teacherSessionToken });
    } else {
      jsonDb.insert('settings', { id: 'main', activeTeacherToken: teacherSessionToken });
    }
    res.cookie('teacher_token', token, { ...COOKIE_OPTS, maxAge: 24 * 60 * 60 * 1000 }).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/teacher/change-password', authenticateTeacher, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'بيانات غير صحيحة' });
    }
    if (newPassword.length < 4) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' });

    const storedSettings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    const currentHash = storedSettings?.teacherPasswordHash ?? (await teacherPasswordHashPromise);
    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    const newHash = await bcrypt.hash(newPassword, 10);
    if (storedSettings) {
      jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { teacherPasswordHash: newHash });
    } else {
      jsonDb.insert('settings', { id: 'main', teacherPasswordHash: newHash });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/check-auth', authenticateTeacher, (req, res) => {
  res.json({ success: true });
});

app.post('/api/teacher/logout', authenticateTeacher, (req, res) => {
  // Clear the server-side session token so any lingering or copied cookie
  // is immediately rejected by authenticateTeacher.
  try {
    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (settings) {
      jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { activeTeacherToken: null });
    }
  } catch { /* ignore */ }
  res.clearCookie('teacher_token', COOKIE_OPTS).json({ success: true });
});

// Lessons API
app.get('/api/youchem/lessons', authenticateTeacher, async (req, res) => {
  try {
    res.json(jsonDb.getAll('lessons'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/lessons', authenticateTeacher, async (req, res) => {
  try {
    const { title, gradeLevel, platform, videoUrl } = req.body;
    const lesson: DbLesson = {
      id: newId(),
      title,
      gradeLevel,
      platform,
      videoUrl,
      isFree: false,
      isHidden: false,
      createdAt: new Date().toISOString(),
    };
    jsonDb.insert('lessons', lesson);
    res.json(lesson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/lessons/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = jsonDb.find('lessons', (l: DbLesson) => l.id === id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const { title, gradeLevel, platform, videoUrl } = req.body;
    const updates: Partial<DbLesson> = {};
    if (title !== undefined) updates.title = title;
    if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel;
    if (platform !== undefined) {
      updates.platform = platform;
      updates.isFree = false;
    }
    if (videoUrl !== undefined) updates.videoUrl = videoUrl;

    const updated = jsonDb.update('lessons', (l: DbLesson) => l.id === id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/lessons/:id/toggle-visibility', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = jsonDb.find('lessons', (l: DbLesson) => l.id === id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const updated = jsonDb.update('lessons', (l: DbLesson) => l.id === id, { isHidden: !lesson.isHidden });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/lessons/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    jsonDb.remove('lessons', (l: DbLesson) => l.id === id);
    jsonDb.remove('quizzes', (q: DbQuiz) => q.lessonId === id);
    jsonDb.remove('studentLessonAccess', (a: DbStudentLessonAccess) => a.lessonId === id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Codes API
app.get('/api/youchem/codes', authenticateTeacher, async (req, res) => {
  try {
    const codes = jsonDb.getAll('codes');
    const codesWithStudent = codes.map((c: DbCode) => {
      const student = c.usedBy ? jsonDb.find('users', (u: DbUser) => u.id === c.usedBy) : null;
      return { ...c, usedByName: student?.name || null };
    });
    res.json(codesWithStudent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/codes/generate', authenticateTeacher, async (req, res) => {
  try {
    const { count, lessonId } = req.body;
    for (let i = 0; i < count; i++) {
      const code: DbCode = {
        id: newId(),
        codeString: `YCH-${randomBytes(4).toString('hex').toUpperCase()}`,
        isUsed: false,
        usedBy: null,
        lessonId: lessonId || undefined,
        createdAt: new Date().toISOString(),
      };
      jsonDb.insert('codes', code);
    }
    res.json({ success: true, generated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/codes/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    jsonDb.remove('codes', (c: DbCode) => c.id === id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Quizzes API
app.get('/api/youchem/quizzes', authenticateTeacher, async (req, res) => {
  try {
    res.json(jsonDb.getAll('quizzes'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/quizzes', authenticateTeacher, async (req, res) => {
  try {
    const { lessonId, questions, examDurationMinutes } = req.body;
    const existing = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (existing) return res.status(409).json({ error: 'يوجد اختبار بالفعل لهذه الحصة — احذفه أولاً لإنشاء اختبار جديد' });
    const quiz: DbQuiz = {
      id: newId(), lessonId, questions,
      examDurationMinutes: examDurationMinutes ? Number(examDurationMinutes) : undefined,
      createdAt: new Date().toISOString(),
    };
    jsonDb.insert('quizzes', quiz);
    res.json(quiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/quizzes/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.id === id);
    if (!quiz) return res.status(404).json({ error: 'الاختبار غير موجود' });
    jsonDb.remove('quizzes', (q: DbQuiz) => q.id === id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: General Files API ───────────────────────────────────────────────

/** Returns current disk usage of FILES_DIR and the configured limit. */
function getFilesUsage() {
  const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
  const limitMB = settings?.filesStorageLimitMB ?? 500;
  let usedBytes = 0;
  if (fs.existsSync(FILES_DIR)) {
    for (const f of fs.readdirSync(FILES_DIR)) {
      try { usedBytes += fs.statSync(path.join(FILES_DIR, f)).size; } catch { /* ignore */ }
    }
  }
  const usedMB = usedBytes / (1024 * 1024);
  return { usedBytes, usedMB: Math.round(usedMB * 100) / 100, limitMB, remainingMB: Math.max(0, Math.round((limitMB - usedMB) * 100) / 100) };
}

app.get('/api/youchem/files/usage', authenticateTeacher, (_req, res) => {
  try { res.json(getFilesUsage()); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/youchem/settings/files-limit', authenticateTeacher, async (req, res) => {
  try {
    const { limitMB } = req.body;
    const parsed = parseInt(limitMB, 10);
    if (isNaN(parsed) || parsed < 1) return res.status(400).json({ error: 'الحد لازم يكون رقم أكبر من صفر' });
    const existing = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (existing) {
      jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { filesStorageLimitMB: parsed });
    } else {
      jsonDb.insert('settings', { id: 'main', filesStorageLimitMB: parsed });
    }
    res.json({ ok: true, limitMB: parsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youchem/files', authenticateTeacher, async (req, res) => {
  try {
    res.json(jsonDb.getAll('files'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/files', authenticateTeacher, fileUpload.single('file'), async (req, res) => {
  try {
    const { title, gradeLevel } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'الملف مطلوب' });
    if (!title) { fs.unlinkSync(file.path); return res.status(400).json({ error: 'عنوان الملف مطلوب' }); }
    if (!['2nd_sec', '3rd_sec', 'all'].includes(gradeLevel)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'الصف الدراسي مطلوب' });
    }
    // Enforce storage limit
    const usage = getFilesUsage();
    if (usage.usedMB + file.size / (1024 * 1024) > usage.limitMB) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: `تجاوزت الحد المسموح به (${usage.limitMB} MB). فاضل ${usage.remainingMB} MB فقط.` });
    }
    const record: DbFile = {
      id: newId(),
      title,
      fileName: file.originalname,
      fileUrl: `/uploads/files/${file.filename}`,
      fileSize: file.size,
      gradeLevel: gradeLevel as DbFile['gradeLevel'],
      uploadedAt: new Date().toISOString(),
    };
    jsonDb.insert('files', record);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/files/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const record = jsonDb.find('files', (f: DbFile) => f.id === id);
    if (!record) return res.status(404).json({ error: 'الملف مش موجود' });
    const filePath = path.join(FILES_DIR, path.basename(record.fileUrl));
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch { /* ignore */ } }
    jsonDb.remove('files', (f: DbFile) => f.id === id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: Files download list ─────────────────────────────────────────────

// Homework API (bubble-sheet PDF homework)
app.get('/api/youchem/homeworks', authenticateTeacher, async (req, res) => {
  try {
    res.json(jsonDb.getAll('homeworks'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/homework', authenticateTeacher, homeworkUpload.single('pdf'), async (req, res) => {
  try {
    const { title, gradeLevel, numQuestions, answerKey } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'ملف PDF مطلوب' });
    if (!title) { fs.unlinkSync(file.path); return res.status(400).json({ error: 'عنوان الواجب مطلوب' }); }

    const parsedAnswerKey = JSON.parse(answerKey);
    const parsedNumQuestions = parseInt(numQuestions, 10);
    if (!Array.isArray(parsedAnswerKey) || parsedAnswerKey.length !== parsedNumQuestions) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'عدد الأسئلة لا يطابق نموذج الإجابة' });
    }

    const homework: DbHomework = {
      id: newId(),
      title,
      gradeLevel,
      pdfUrl: `/uploads/homeworks/${file.filename}`,
      pdfFileName: file.originalname,
      numQuestions: parsedNumQuestions,
      answerKey: parsedAnswerKey,
      createdAt: new Date().toISOString(),
    };
    jsonDb.insert('homeworks', homework);
    res.json(homework);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/homework/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.id === id);
    if (homework) {
      const filePath = path.join(UPLOADS_DIR, path.basename(homework.pdfUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    jsonDb.remove('homeworks', (h: DbHomework) => h.id === id);
    jsonDb.remove('homeworkSubmissions', (s: DbHomeworkSubmission) => s.homeworkId === id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Students & Exemptions API
app.get('/api/youchem/students', authenticateTeacher, async (req, res) => {
  try {
    const allStudents = jsonDb.filter('users', (u: DbUser) => u.role === 'student');
    const allAccesses = jsonDb.getAll('studentLessonAccess');

    const studentsWithAccess = allStudents.map((s: DbUser) => ({
      ...s,
      accesses: allAccesses.filter((a: DbStudentLessonAccess) => a.userId === s.id),
    }));

    res.json(studentsWithAccess);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/students/:userId/block', authenticateTeacher, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).json({ error: 'الطالب غير موجود' });
    const shouldBlock = !user.blocked;
    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    const blockedDeviceIds = [...(settings?.blockedDeviceIds || [])];

    if (shouldBlock && user.deviceId && !blockedDeviceIds.includes(user.deviceId)) {
      blockedDeviceIds.push(user.deviceId);
    }
    if (!shouldBlock && user.deviceId) {
      const remainingDeviceIds = blockedDeviceIds.filter((deviceId) => deviceId !== user.deviceId);
      if (settings) {
        jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { blockedDeviceIds: remainingDeviceIds });
      }
    } else if (shouldBlock) {
      if (settings) {
        jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { blockedDeviceIds });
      } else {
        jsonDb.insert('settings', { id: 'main', blockedDeviceIds });
      }
    }

    const updated = jsonDb.update('users', (u: DbUser) => u.id === userId, {
      blocked: shouldBlock,
      ...(shouldBlock ? { activeSessionToken: null, sessionExpiresAt: null } : {}),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/students/:userId', authenticateTeacher, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).json({ error: 'الطالب غير موجود' });

    jsonDb.remove('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === userId);
    jsonDb.remove('homeworkSubmissions', (s: DbHomeworkSubmission) => s.userId === userId);
    jsonDb.remove('users', (u: DbUser) => u.id === userId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/students/:userId/unlink-device', authenticateTeacher, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).json({ error: 'الطالب غير موجود' });

    // Clear both the device binding and the active session. This lets the
    // student sign in again from any device and invalidates the old cookie.
    const updated = jsonDb.update('users', (u: DbUser) => u.id === userId, {
      deviceId: null,
      activeSessionToken: null,
      sessionExpiresAt: null,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/students/:userId/lessons/:lessonId/exempt', authenticateTeacher, async (req, res) => {
  try {
    const { userId, lessonId } = req.params;
    const access = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === userId && a.lessonId === lessonId
    );

    if (access) {
      const newExempt = !access.quizExempt;
      const updated = jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === userId && a.lessonId === lessonId,
        {
          quizExempt: newExempt,
          // Granting exemption clears the lock so the student can access the lesson
          ...(newExempt ? { lessonLocked: false } : {}),
        }
      );
      res.json(updated);
    } else {
      const inserted: DbStudentLessonAccess = {
        userId,
        lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: false,
        quizExempt: true,
        lessonLocked: false,
      };
      jsonDb.insert('studentLessonAccess', inserted);
      res.json(inserted);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset exam so student can retake (keeps their access/code, clears quiz state)
app.patch('/api/youchem/students/:userId/lessons/:lessonId/reset-exam', authenticateTeacher, async (req, res) => {
  try {
    const { userId, lessonId } = req.params;
    const access = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === userId && a.lessonId === lessonId
    );
    if (!access) {
      return res.status(404).json({ error: 'لا يوجد سجل وصول لهذا الطالب على هذه الحصة' });
    }
    const updated = jsonDb.update(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === userId && a.lessonId === lessonId,
      {
        quizPassed: false,
        quizExempt: false,
        lessonLocked: true,   // keep locked — student must pass the retake to unlock
        quizScore: undefined,
        quizTotal: undefined,
        quizResults: undefined,
      }
    );
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: manually entered exam grades ────────────────────────────────────
app.get('/api/youchem/manual-grades', authenticateTeacher, async (_req, res) => {
  try {
    const grades = jsonDb.getAll('manualExamGrades') as DbManualExamGrade[];
    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student')
      .map(({ activeSessionToken, sessionExpiresAt, deviceId, ...student }) => student);
    res.json({ grades, students });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/manual-grades', authenticateTeacher, async (req, res) => {
  try {
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId : '';
    const examName = typeof req.body?.examName === 'string' ? req.body.examName.trim() : '';
    const rawScore = typeof req.body?.score === 'number' ? req.body.score : Number(req.body?.score);
    const score = Number.isFinite(rawScore) ? rawScore : NaN;
    const student = jsonDb.find('users', (u: DbUser) => u.id === studentId && u.role === 'student');

    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    if (!examName) return res.status(400).json({ error: 'اكتب اسم الامتحان' });
    if (examName.length > 120) return res.status(400).json({ error: 'اسم الامتحان طويل جدًا' });
    if (!Number.isFinite(score) || score < 0 || score > 60) {
      return res.status(400).json({ error: 'الدرجة لازم تكون من 0 إلى 60' });
    }

    const normalizedScore = Math.round(score * 100) / 100;
    const percentage = Math.round((normalizedScore / 60) * 10000) / 100;
    const existing = jsonDb.find(
      'manualExamGrades',
      (g: DbManualExamGrade) => g.studentId === studentId && g.examName.toLowerCase() === examName.toLowerCase(),
    );
    const updates = {
      examName,
      score: normalizedScore,
      maxScore: 60 as const,
      percentage,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    };
    const grade = existing
      ? jsonDb.update('manualExamGrades', (g: DbManualExamGrade) => g.id === existing.id, updates)
      : jsonDb.insert('manualExamGrades', {
          id: newId(),
          studentId,
          ...updates,
          createdAt: new Date().toISOString(),
        } satisfies DbManualExamGrade);

    res.json({ ...grade, student: { id: student.id, name: student.name, email: student.email, phone: student.phone } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- STUDENT API (Google Sign-In) ---

app.post('/api/student/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken مطلوب' });
    const deviceId = typeof req.body.deviceId === 'string' ? req.body.deviceId.trim() : '';
    if (!isValidDeviceId(deviceId)) {
      return res.status(400).json({ error: 'تعذر التحقق من الجهاز. حدّث الصفحة وحاول مرة أخرى.' });
    }

    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(401).json({ error: 'فشل التحقق من حساب جوجل' });

    const { sub: googleId, email, name, picture } = payload;

    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (settings?.blockedDeviceIds?.includes(deviceId)) {
      return res.status(403).json({ error: 'DEVICE_BLOCKED' });
    }

    let user = jsonDb.find('users', (u: DbUser) => u.googleId === googleId || u.email === email);
    if (user?.blocked) {
      return res.status(403).json({ error: 'تم حظر هذا الحساب من الدخول إلى المنصة.' });
    }

    // ── Single-device enforcement ─────────────────────────────────────────
    // Block a new login if the user already has a live (non-expired) session.
    // An expired session (past sessionExpiresAt) is treated as cleared so the
    // student can log in again without needing to manually log out first.
    const sessionIsLive =
      user?.activeSessionToken &&
      user.sessionExpiresAt &&
      new Date(user.sessionExpiresAt) > new Date();
    if (sessionIsLive && user?.deviceId !== deviceId) {
      return res.status(403).json({ error: 'DEVICE_LOCKED' });
    }

    const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — mirrors JWT
    const sessionToken = randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    if (!user) {
      // ── New student — do NOT save to DB yet ───────────────────────────────
      // We only create the DB record once they successfully submit the full
      // profile form (complete-profile endpoint). Closing the tab before that
      // point leaves zero trace in the database.
      const pendingToken = jwt.sign(
        { role: 'student', pending: true, googleId, email, name: name || '', picture: picture || '', deviceId },
        JWT_SECRET,
        { expiresIn: '2h' },
      );
      res.cookie('student_token', pendingToken, { ...COOKIE_OPTS, maxAge: 2 * 60 * 60 * 1000 });
      return res.json({
        success: true,
        user: { name: name || '', email, picture: picture || '' },
        needsProfile: true,
        missingFields: ['name', 'phone', 'guardianPhone', 'school', 'gradeLevel'],
        profileErrors: {},
        picture,
      });
    } else {
      // Backfill googleId / update picture / set session token.
      const updates: Partial<DbUser> = { activeSessionToken: sessionToken, sessionExpiresAt, deviceId };
      if (!user.googleId) updates.googleId = googleId;
      if (picture) updates.picture = picture;
      user = jsonDb.update('users', (u: DbUser) => u.id === user!.id, updates);
    }

    const token = jwt.sign(
      { role: 'student', studentId: user.id, sessionToken, deviceId },
      JWT_SECRET,
      { expiresIn: '30d' },
    );
    res.cookie('student_token', token, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });

    const profileErrors = getStudentProfileErrors(user);
    const missingFields = Object.keys(profileErrors);
    const needsProfile = missingFields.length > 0;
    res.json({ success: true, user, needsProfile, missingFields, profileErrors, picture });
  } catch (err: any) {
    console.error('Google login failed:', err.message);
    res.status(401).json({ error: 'فشل تسجيل الدخول بحساب جوجل' });
  }
});

app.get('/api/student/check-auth', authenticateStudent, (req, res) => {
  const pendingGoogle = (req as any).pendingGoogle;
  if (pendingGoogle) {
    // Pending user — no DB record yet; tell frontend to show profile form.
    return res.json({
      success: true,
      user: { name: pendingGoogle.name, email: pendingGoogle.email, picture: pendingGoogle.picture },
      needsProfile: true,
      missingFields: ['name', 'phone', 'guardianPhone', 'school', 'gradeLevel'],
      profileErrors: {},
      pending: true,
    });
  }
  const studentId = (req as any).studentId;
  const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const profileErrors = getStudentProfileErrors(user);
  const missingFields = Object.keys(profileErrors);
  const needsProfile = missingFields.length > 0;
  res.json({ success: true, user, needsProfile, missingFields, profileErrors });
});

// Save incomplete profile fields as the student types. This intentionally
// does not run full profile validation: the student may close the tab before
// all required fields are complete and should be able to resume later.
app.post('/api/student/profile-draft', authenticateStudent, async (req, res) => {
  try {
    // Pending users have no DB record yet — the draft lives only in
    // localStorage on the client side. Just acknowledge the request.
    if ((req as any).pendingGoogle) return res.json({ success: true });

    const studentId = (req as any).studentId;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const updates: Partial<DbUser> = {};

    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (typeof body.phone === 'string') {
      updates.phone = normalizeArabicDigits(body.phone.trim());
    }
    if (typeof body.guardianPhone === 'string') {
      updates.guardianPhone = normalizeArabicDigits(body.guardianPhone.trim());
    }
    if (typeof body.school === 'string') updates.school = body.school.trim();
    if (body.gradeLevel === '2nd_sec' || body.gradeLevel === '3rd_sec') {
      updates.gradeLevel = body.gradeLevel;
    } else if (body.gradeLevel === '' || body.gradeLevel === null) {
      updates.gradeLevel = null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات للحفظ' });
    }

    const updated = jsonDb.update(
      'users',
      (u: DbUser) => u.id === studentId,
      updates,
    );
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/complete-profile', authenticateStudent, async (req, res) => {
  try {
    const studentId   = (req as any).studentId;
    const pendingGoogle = (req as any).pendingGoogle;

    const { name, school, gradeLevel } = req.body;
    const phone         = normalizeArabicDigits(typeof req.body.phone         === 'string' ? req.body.phone.trim()         : '');
    const guardianPhone = normalizeArabicDigits(typeof req.body.guardianPhone === 'string' ? req.body.guardianPhone.trim() : '');

    const profileErrors = getStudentProfileErrors({ name, phone, guardianPhone, school, gradeLevel });
    if (Object.keys(profileErrors).length > 0) {
      return res.status(400).json({ error: Object.values(profileErrors)[0], profileErrors });
    }

    // ── Brand-new student: create DB record for the first time ────────────
    if (pendingGoogle) {
      const { googleId, email, picture, deviceId } = pendingGoogle;
      const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
      const sessionToken   = randomBytes(32).toString('hex');
      const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

      const newUser: DbUser = {
        id: newId(),
        googleId,
        name: name.trim(),
        email,
        picture: picture || '',
        phone,
        guardianPhone,
        school: school.trim(),
        role: 'student',
        gradeLevel,
        createdAt: new Date().toISOString(),
        deviceId,
        activeSessionToken: sessionToken,
        sessionExpiresAt,
        blocked: false,
      } as DbUser;
      jsonDb.insert('users', newUser);

      const fullToken = jwt.sign(
        { role: 'student', studentId: newUser.id, sessionToken, deviceId },
        JWT_SECRET,
        { expiresIn: '30d' },
      );
      res.cookie('student_token', fullToken, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.json({ success: true, user: newUser });
    }

    // ── Existing student: just update their profile ───────────────────────
    const updated = jsonDb.update('users', (u: DbUser) => u.id === studentId, {
      name: name.trim(),
      phone,
      guardianPhone,
      school: school.trim(),
      gradeLevel,
    });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/logout', (req, res) => {
  // Only clears the browser cookie — does NOT clear activeSessionToken in the
  // DB. The device lock is permanent; only a teacher can unlock the account.
  // This prevents a student from bypassing the single-device rule by simply
  // logging out and logging in again from a different device.
  res.clearCookie('student_token', COOKIE_OPTS).json({ success: true });
});

app.get('/api/student/lessons', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
    if (!user || !user.gradeLevel) return res.status(400).json({ error: 'Grade not set' });

    const availableLessons = jsonDb.filter(
      'lessons',
      (l: DbLesson) => l.gradeLevel === user.gradeLevel && !l.isHidden
    );
    const accesses = jsonDb.filter('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === studentId);

    res.json({ lessons: availableLessons, accesses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/grades', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const grades = jsonDb.filter(
      'manualExamGrades',
      (g: DbManualExamGrade) => g.studentId === studentId && g.confirmed,
    ).sort((a: DbManualExamGrade, b: DbManualExamGrade) =>
      new Date(b.confirmedAt || b.createdAt).getTime() - new Date(a.confirmedAt || a.createdAt).getTime(),
    );
    res.json(grades);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/validate-code', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { lessonId, code } = req.body;
    const studentId = (req as any).studentId;

    const key = jsonDb.find('codes', (c: DbCode) => c.codeString === code);
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed) return res.status(400).json({ error: 'الكود مستخدم من قبل' });
    // Enforce lesson-specific codes: a code tied to a lesson can ONLY unlock that lesson.
    if (key.lessonId && key.lessonId !== lessonId) {
      return res.status(400).json({ error: 'هذا الكود خاص بحصة مختلفة' });
    }

    jsonDb.update('codes', (c: DbCode) => c.id === key.id, { isUsed: true, usedBy: studentId });

    const access: DbStudentLessonAccess = {
      userId: studentId,
      lessonId,
      unlockedAt: new Date().toISOString(),
      quizPassed: false,
      quizExempt: false,
    };
    jsonDb.insert('studentLessonAccess', access);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch the real quiz for a lesson, with correct answers stripped so students can't see them.
app.get('/api/student/quiz/:lessonId', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (!quiz || !Array.isArray(quiz.questions)) return res.json({ questions: [] });

    const sanitized = quiz.questions.map((q: any) => ({
      question: q.question,
      image: q.image || null,
    }));
    res.json({ questions: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/submit-quiz', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    const studentId = (req as any).studentId;

    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);

    let score = 0;
    let total = 10;
    // Per-question breakdown so the student can see what they got right/wrong
    // and what the correct answer was, right after submitting.
    let results: Array<{ question: string; studentAnswer: string | null; correctAnswer: string; isCorrect: boolean }> = [];

    if (quiz && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      total = quiz.questions.length;
      results = quiz.questions.map((q: any, idx: number) => {
        const studentAnswer = answers?.[idx] !== undefined && answers[idx] !== '' ? answers[idx] : null;
        const isCorrect = studentAnswer !== null && studentAnswer === q.correct_answer;
        if (isCorrect) score++;
        return {
          question: q.question,
          studentAnswer,
          correctAnswer: q.correct_answer,
          isCorrect,
        };
      });
    } else if (answers && answers.length >= 5) {
      // No quiz configured yet for this lesson: fall back to previous permissive behavior
      score = 10;
    }

    const passed = score >= Math.ceil(total / 2);

    // Always persist the latest attempt (score/results) so the student can
    // see it again when they come back to the lesson, whether they passed or not.
    const existing = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
    );
    // Lesson gets locked if score < 5 (out of 10) or < 50% of total.
    // Once locked, only teacher exemption or a passing retake clears it.
    const nowLocked = !passed;

    if (existing) {
      const alreadyPassed = existing.quizPassed;
      jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId,
        {
          quizPassed: passed || alreadyPassed,
          quizScore: score,
          quizTotal: total,
          quizResults: results,
          lessonLocked: alreadyPassed ? false : nowLocked,
          quizAttempts: (existing.quizAttempts || 0) + 1,
        }
      );
    } else {
      jsonDb.insert('studentLessonAccess', {
        userId: studentId,
        lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: passed,
        quizExempt: false,
        quizScore: score,
        quizTotal: total,
        quizResults: results,
        lessonLocked: nowLocked,
        quizAttempts: 1,
      });
    }

    res.json({ score, total, passed, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Exam flow (standalone: code → lesson picker → quiz → corrected results) ──

// Validate a generic code + lessonId, create access, return quiz questions if any.
app.post('/api/student/exam/unlock', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { code, lessonId } = req.body;
    const studentId = (req as any).studentId;

    const key = jsonDb.find('codes', (c: DbCode) => c.codeString === (code || '').trim().toUpperCase());
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed) return res.status(400).json({ error: 'الكود مستخدم أو محروق من قبل' });
    // Enforce lesson-specific codes
    if (key.lessonId && key.lessonId !== lessonId) {
      return res.status(400).json({ error: 'هذا الكود خاص بحصة مختلفة' });
    }

    // Mark code as used on first use
    if (!key.isUsed) {
      jsonDb.update('codes', (c: DbCode) => c.id === key.id, { isUsed: true, usedBy: studentId });
    }

    // Ensure access record exists for this lesson
    const existing = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
    );
    if (!existing) {
      jsonDb.insert('studentLessonAccess', {
        userId: studentId,
        lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: false,
        quizExempt: false,
      });
    }

    // Return quiz questions if lesson has one (answers stripped)
    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return res.json({ quizExists: false, questions: [], lessonId });
    }

    const sanitized = quiz.questions.map((q: any) => ({
      question: q.question,
      image: q.image || null,
    }));

    res.json({ quizExists: true, questions: sanitized, lessonId, examDurationMinutes: quiz.examDurationMinutes || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy: validate code and return quiz questions (images included, answers stripped)
app.post('/api/student/exam/start', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { code } = req.body;
    const studentId = (req as any).studentId;

    const key = jsonDb.find('codes', (c: DbCode) => c.codeString === (code || '').trim().toUpperCase());
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed) return res.status(400).json({ error: 'الكود مستخدم أو محروق من قبل' });
    if (!key.lessonId) return res.status(400).json({ error: 'هذا الكود غير مرتبط بامتحان — تواصل مع مستر أحمد' });

    const lessonId = key.lessonId;

    // Mark code as used if this is the first time
    if (!key.isUsed) {
      jsonDb.update('codes', (c: DbCode) => c.id === key.id, { isUsed: true, usedBy: studentId });
    }

    // Ensure access record exists
    const existing = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
    );
    if (!existing) {
      jsonDb.insert('studentLessonAccess', {
        userId: studentId,
        lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: false,
        quizExempt: false,
      });
    }

    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return res.status(404).json({ error: 'لم يتم إضافة امتحان لهذا الدرس بعد' });
    }

    const sanitized = quiz.questions.map((q: any) => ({
      question: q.question,
      image: q.image || null,
    }));

    res.json({ lessonId, questions: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: submit answers and return full corrected results (with images)
app.post('/api/student/exam/submit', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    const studentId = (req as any).studentId;

    const quiz = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (!quiz || !Array.isArray(quiz.questions)) {
      return res.status(404).json({ error: 'الامتحان غير موجود' });
    }

    const total = quiz.questions.length;
    let score = 0;
    const results = quiz.questions.map((q: any, idx: number) => {
      const studentAnswer =
        answers?.[idx] !== undefined && answers[idx] !== '' ? answers[idx] : null;
      const isCorrect = studentAnswer !== null && studentAnswer === q.correct_answer;
      if (isCorrect) score++;
      return {
        question: q.question,
        image: q.image || null,
        studentAnswer,
        correctAnswer: q.correct_answer,
        isCorrect,
      };
    });

    const passed = score >= Math.ceil(total / 2);

    // Persist the result
    const persistResults = results.map(({ question, studentAnswer, correctAnswer, isCorrect }) => ({
      question, studentAnswer, correctAnswer, isCorrect,
    }));
    const existing = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
    );
    const nowLocked2 = !passed;

    if (existing) {
      const alreadyPassed2 = existing.quizPassed;
      jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId,
        {
          quizPassed: passed || alreadyPassed2,
          quizScore: score,
          quizTotal: total,
          quizResults: persistResults,
          lessonLocked: alreadyPassed2 ? false : nowLocked2,
          quizAttempts: (existing.quizAttempts || 0) + 1,
        }
      );
    } else {
      jsonDb.insert('studentLessonAccess', {
        userId: studentId, lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: passed, quizExempt: false,
        quizScore: score, quizTotal: total, quizResults: persistResults,
        lessonLocked: nowLocked2,
        quizAttempts: 1,
      });
    }

    res.json({ score, total, passed, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Homework: fetch the PDF + question count for a lesson, without the answer key.
app.get('/api/student/homework/:homeworkId', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const studentId = (req as any).studentId;
    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.id === homeworkId);
    if (!homework) return res.json({ homework: null });

    // If the student already submitted this homework, return their past
    // result too so it shows again instead of a blank form on revisit.
    const submission = jsonDb.find(
      'homeworkSubmissions',
      (s: DbHomeworkSubmission) => s.homeworkId === homework.id && s.userId === studentId
    );
    let pastResult: any = null;
    if (submission) {
      const results = homework.answerKey.map((correctAnswer, idx) => {
        const studentAnswer = submission.answers[idx] ?? null;
        const isCorrect = studentAnswer === correctAnswer;
        return { questionNumber: idx + 1, studentAnswer, correctAnswer, isCorrect };
      });
      pastResult = { score: submission.score, total: submission.total, results };
    }

    res.json({
      homework: {
        id: homework.id,
        title: homework.title,
        pdfUrl: homework.pdfUrl,
        pdfFileName: homework.pdfFileName,
        numQuestions: homework.numQuestions,
      },
      pastResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Files available for the student's grade
app.get('/api/student/files', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
    if (!user || !user.gradeLevel) return res.status(400).json({ error: 'Grade not set' });
    const files = jsonDb.filter('files', (f: DbFile) => f.gradeLevel === 'all' || f.gradeLevel === user.gradeLevel);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregated homework list for the student's grade, no lesson access required.
app.get('/api/student/homeworks', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
    if (!user || !user.gradeLevel) return res.status(400).json({ error: 'Grade not set' });

    const homeworks = jsonDb.filter('homeworks', (h: DbHomework) => h.gradeLevel === user.gradeLevel);
    const submissions = jsonDb.filter(
      'homeworkSubmissions',
      (s: DbHomeworkSubmission) => s.userId === studentId
    );

    const result = homeworks.map((h: DbHomework) => {
      const submission = submissions.find((s: DbHomeworkSubmission) => s.homeworkId === h.id);
      return {
        id: h.id,
        title: h.title,
        pdfUrl: h.pdfUrl,
        numQuestions: h.numQuestions,
        submission: submission ? { score: submission.score, total: submission.total } : null,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/submit-homework', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { homeworkId, answers } = req.body;
    const studentId = (req as any).studentId;

    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.id === homeworkId);
    if (!homework) return res.status(404).json({ error: 'الواجب غير موجود' });
    if (!Array.isArray(answers) || answers.length !== homework.numQuestions) {
      return res.status(400).json({ error: 'الرجاء الإجابة على جميع الأسئلة' });
    }

    let score = 0;
    const results = homework.answerKey.map((correctAnswer, idx) => {
      const studentAnswer = answers[idx] ?? null;
      const isCorrect = studentAnswer === correctAnswer;
      if (isCorrect) score++;
      return { questionNumber: idx + 1, studentAnswer, correctAnswer, isCorrect };
    });

    const submission: DbHomeworkSubmission = {
      id: newId(),
      userId: studentId,
      homeworkId: homework.id,
      answers,
      score,
      total: homework.numQuestions,
      createdAt: new Date().toISOString(),
    };
    jsonDb.insert('homeworkSubmissions', submission);

    res.json({ score, total: homework.numQuestions, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: lesson viewing heartbeat (increments viewingMinutes once per call) ──
app.post('/api/student/lesson-heartbeat', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    const { lessonId } = req.body;
    const studentId = (req as any).studentId;
    if (!lessonId) return res.status(400).json({ error: 'lessonId مطلوب' });
    const access = jsonDb.find(
      'studentLessonAccess',
      (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
    );
    if (access) {
      jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId,
        { viewingMinutes: (access.viewingMinutes || 0) + 1 }
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: student file (profile + full activity) ───────────────────────────
app.get('/api/youchem/student-file/:userId', authenticateTeacher, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).json({ error: 'الطالب غير موجود' });

    const accesses = jsonDb.filter('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === userId);
    const homeworkSubmissions = jsonDb.filter('homeworkSubmissions', (s: DbHomeworkSubmission) => s.userId === userId);
    const lessons = jsonDb.getAll('lessons') as DbLesson[];
    const homeworks = jsonDb.getAll('homeworks') as DbHomework[];

    const enrichedAccesses = accesses.map((a: DbStudentLessonAccess) => {
      const lesson = lessons.find((l: DbLesson) => l.id === a.lessonId);
      return { ...a, lessonTitle: lesson?.title || a.lessonId, gradeLevel: lesson?.gradeLevel };
    });

    const enrichedSubmissions = homeworkSubmissions.map((s: DbHomeworkSubmission) => {
      const hw = homeworks.find((h: DbHomework) => h.id === s.homeworkId);
      return { ...s, homeworkTitle: hw?.title || s.homeworkId };
    });

    res.json({ user, accesses: enrichedAccesses, homeworkSubmissions: enrichedSubmissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── HTML report builder (no Puppeteer — browser prints/saves to PDF) ──────────

/**
 * Build a self-contained HTML report for one student.
 *
 * All three brand images (logo, stamp, signature) are already pre-loaded as
 * Base64 data-URIs at server startup (LOGO_B64 / STAMP_B64 / SIGN_B64) and
 * are injected directly into the `src` attributes — zero external requests,
 * works offline, always visible in the saved PDF.
 *
 * The page is designed to fit on a single A4 sheet when the user presses
 * Ctrl+P / window.print():
 *   • @page sets A4 with tight margins.
 *   • Everything uses compressed font-sizes and padding inside @media print.
 *   • Tables use font-size:8px and minimal cell padding in print.
 *   • The verification row (stamp + signature) has break-inside:avoid so it
 *     never splits across pages.
 *
 * Pass autoPrint=true to trigger window.print() automatically on page load
 * (used from the "طباعة" button on the teacher dashboard).
 */
function buildStudentPdfHtml(
  user: DbUser,
  accesses: DbStudentLessonAccess[],
  homeworkSubmissions: DbHomeworkSubmission[],
  lessons: DbLesson[],
  homeworks: DbHomework[],
  autoPrint = false,
): string {
  // ── helpers ────────────────────────────────────────────────────────────────
  const esc = (v: any) =>
    String(v ?? '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const gradeLabel =
    user.gradeLevel === '2nd_sec' ? 'تاني ثانوي'
    : user.gradeLevel === '3rd_sec' ? 'تالت ثانوي'
    : '—';
  const registeredDate = new Date(user.createdAt).toLocaleDateString('ar-EG');
  const generatedDate  = new Date().toLocaleDateString('ar-EG');

  // ── lesson rows ────────────────────────────────────────────────────────────
  const lessonRows = accesses.map((a: DbStudentLessonAccess) => {
    const lesson = lessons.find((l: DbLesson) => l.id === a.lessonId);
    const quizCell = a.quizExempt
      ? `<span class="badge amber">معفي</span>`
      : a.quizTotal != null
        ? `<span class="badge ${a.quizPassed ? 'green' : 'red'}">${a.quizScore}/${a.quizTotal}</span>`
        : `<span class="dim">—</span>`;
    const statusCell = a.quizPassed
      ? '<span class="ok">✓ اجتاز</span>'
      : a.quizExempt
      ? '<span class="warn">معفي</span>'
      : a.lessonLocked
      ? '<span class="err">🔒 مقفول</span>'
      : a.quizTotal == null
      ? '<span class="dim">لا يوجد امتحان</span>'
      : '<span class="err">✗ لم يجتز</span>';
    return `<tr>
      <td>${esc(lesson?.title || a.lessonId)}</td>
      <td class="c">${a.viewingMinutes || 0} د</td>
      <td class="c">${quizCell}</td>
      <td class="c">${statusCell}</td>
      <td class="c dim">${a.quizAttempts ?? '—'}</td>
      <td class="c dim">${new Date(a.unlockedAt).toLocaleDateString('ar-EG')}</td>
    </tr>`;
  }).join('');

  // ── homework rows ──────────────────────────────────────────────────────────
  const hwRows = homeworkSubmissions.map((s: DbHomeworkSubmission) => {
    const hw  = homeworks.find((h: DbHomework) => h.id === s.homeworkId);
    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
    return `<tr>
      <td>${esc(hw?.title || s.homeworkId)}</td>
      <td class="c"><span class="badge ${pct >= 50 ? 'green' : 'red'}">${s.score}/${s.total}</span></td>
      <td class="c">${pct}%</td>
      <td class="c dim">${new Date(s.createdAt).toLocaleDateString('ar-EG')}</td>
    </tr>`;
  }).join('');

  // ── HTML ───────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ملف الطالب — ${esc(user.name)}</title>

<!--
  Cairo font is loaded from Google Fonts.
  In print: if the font isn't cached the browser will fall back to Tahoma/Arial,
  which is fine — layout is stable regardless.
-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">

<style>
/* ═══════════════════════════════════════════════════════════
   RESET & BASE
   ═══════════════════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --blue:   #1e3a8a;
  --blue2:  #2563eb;
  --slate:  #334155;
  --muted:  #94a3b8;
  --border: #e2e8f0;
  --bg:     #f8fafc;
}

body {
  font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
  direction: rtl;
  color: var(--slate);
  background: #fff;
  font-size: 11px;
  line-height: 1.55;
  /* Force colour/background printing in all browsers */
  -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
}

/* ═══════════════════════════════════════════════════════════
   PAGE WRAPPER  (screen: centred card, print: full width)
   ═══════════════════════════════════════════════════════════ */
.page {
  max-width: 210mm;   /* A4 width */
  margin: 0 auto;
  padding: 22px 30px 26px;
  background: #fff;
}

/* ═══════════════════════════════════════════════════════════
   PRINT BUTTON (hidden in print)
   ═══════════════════════════════════════════════════════════ */
.print-btn {
  display: block;
  margin: 0 auto 18px;
  padding: 9px 28px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.3px;
}
.print-btn:hover { background: var(--blue2); }

/* ═══════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════ */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 3px solid var(--blue);
}
.header-logo {
  height: 52px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}
.header-center { flex: 1; text-align: center; }
.header-center h1 {
  font-size: 17px;
  font-weight: 900;
  color: var(--blue);
  letter-spacing: -0.3px;
}
.header-center p { font-size: 9px; color: var(--muted); margin-top: 2px; }
.header-meta {
  font-size: 9px;
  color: var(--muted);
  text-align: left;
  white-space: nowrap;
  flex-shrink: 0;
}
.header-meta strong { color: var(--slate); }

/* ═══════════════════════════════════════════════════════════
   SECTION BANNER
   ═══════════════════════════════════════════════════════════ */
.section {
  background: linear-gradient(90deg, var(--blue) 0%, var(--blue2) 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 6px;
  margin: 13px 0 7px;
}

/* ═══════════════════════════════════════════════════════════
   PROFILE GRID
   ═══════════════════════════════════════════════════════════ */
.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.info-box {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  overflow: hidden;
}
.info-box .lbl {
  font-size: 7.5px;
  color: var(--muted);
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.info-box .val {
  font-size: 10.5px;
  font-weight: 700;
  color: #1e293b;
  margin-top: 1px;
  word-break: break-all;
}

/* ═══════════════════════════════════════════════════════════
   TABLES
   ═══════════════════════════════════════════════════════════ */
table { width: 100%; border-collapse: collapse; font-size: 10px; }
thead tr { background: #eff6ff; }
thead th {
  padding: 6px 9px;
  font-weight: 700;
  color: #1e40af;
  text-align: right;
  border-bottom: 2px solid #bfdbfe;
  white-space: nowrap;
}
tbody tr:nth-child(even) { background: var(--bg); }
tbody td { padding: 5px 9px; border-bottom: 1px solid #f1f5f9; }
.c   { text-align: center !important; }
.dim { color: var(--muted); }

/* status text colours */
.ok   { color: #15803d; font-weight: 700; }
.warn { color: #92400e; font-weight: 700; }
.err  { color: #b91c1c; font-weight: 700; }

/* ═══════════════════════════════════════════════════════════
   BADGES
   ═══════════════════════════════════════════════════════════ */
.badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}
.badge.green { background: #dcfce7; color: #15803d; }
.badge.red   { background: #fee2e2; color: #b91c1c; }
.badge.amber { background: #fef3c7; color: #92400e; }

/* ═══════════════════════════════════════════════════════════
   EMPTY NOTE
   ═══════════════════════════════════════════════════════════ */
.empty { color: var(--muted); font-style: italic; padding: 8px 0; text-align: center; font-size: 10px; }

/* ═══════════════════════════════════════════════════════════
   VERIFICATION ROW  (stamp + signature)

   Key rules that make it work in print:
   • break-inside: avoid  →  never splits across pages
   • Images embedded as Base64 data-URIs → no external fetch,
     always visible even offline or inside a PDF
   • Signature PNG (600×300) has blank margins around the actual
     mark → object-fit:none + explicit width/height crops to the
     visible ink only, without needing overflow:hidden
   ═══════════════════════════════════════════════════════════ */
.verify-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
  padding: 14px 14px 8px;
  border-top: 1px dashed #cbd5e1;
  /* Prevent page-break inside this block */
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Stamp */
.stamp-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
}
.stamp-img {
  display: block;
  width: 130px;
  height: 130px;
  object-fit: contain;
  -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
}
.stamp-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--blue);
  text-align: center;
}

/* Signature — PNG 600×300, actual ink ≈ 170×102 px centred around (306,145).
   width:220px + height:110px creates a viewport that frames exactly the ink
   region when object-position is centered. No overflow:hidden required — the
   <img> itself is already clipped by its own width/height in all browsers. */
.sig-box {
  flex: 0 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.sig-img {
  display: block;
  width: 220px;
  height: 110px;
  object-fit: none;
  object-position: center center;
  -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
}
.sig-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--slate);
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
.doc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
  font-size: 8.5px;
  color: var(--muted);
}

/* ═══════════════════════════════════════════════════════════
   PRINT OVERRIDES
   Target: single A4 page, no extras
   ═══════════════════════════════════════════════════════════ */
@media print {
  /* ── Page geometry ── */
  @page {
    size: A4 portrait;
    margin: 10mm 9mm 9mm 9mm;
  }

  /* ── Hide browser chrome & print button ── */
  .print-btn { display: none !important; }

  body {
    font-size: 9.5px;
    background: #fff;
  }

  .page {
    max-width: none;
    padding: 0;
    margin: 0;
  }

  /* ── Header ── */
  .header { padding-bottom: 8px; margin-bottom: 10px; }
  .header-logo { height: 42px; }
  .header-center h1 { font-size: 14px; }

  /* ── Sections ── */
  .section { margin: 8px 0 5px; padding: 3px 10px; font-size: 9.5px; }

  /* ── Profile grid ── */
  .profile-grid { gap: 4px; }
  .info-box { padding: 4px 7px; }
  .info-box .lbl { font-size: 7px; }
  .info-box .val { font-size: 9px; }

  /* ── Tables — most aggressive compression ── */
  table { font-size: 8px; }
  thead th { padding: 3px 6px; font-size: 8px; }
  tbody td { padding: 3px 6px; }
  .badge { font-size: 7.5px; padding: 1px 5px; }

  /* ── Verification row ── */
  .verify-row { margin-top: 10px; padding: 10px 10px 6px; gap: 12px; }
  .stamp-img  { width: 100px; height: 100px; }
  .sig-img    { width: 190px; height: 100px; }
  .stamp-label, .sig-label { font-size: 8.5px; }

  /* ── Footer ── */
  .doc-footer { margin-top: 8px; padding-top: 5px; font-size: 7.5px; }

  /* Prevent orphan rows from spilling to page 2 */
  tr { break-inside: avoid; page-break-inside: avoid; }
}
</style>

${autoPrint
  ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>`
  : ''}
</head>
<body>
<div class="page">

  <!-- Print button (hidden in print) -->
  <button class="print-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>

  <!-- ══ HEADER ══ -->
  <div class="header">
    ${LOGO_B64 ? `<img src="${LOGO_B64}" class="header-logo" alt="YouChem Logo">` : '<div></div>'}
    <div class="header-center">
      <h1>ملف الطالب</h1>
      <p>منصة يوتشيم التعليمية &mdash; YouChem Educational Platform</p>
    </div>
    <div class="header-meta">
      تاريخ الإصدار<br>
      <strong>${esc(generatedDate)}</strong>
    </div>
  </div>

  <!-- ══ STUDENT PROFILE ══ -->
  <div class="section">📋 بيانات الطالب</div>
  <div class="profile-grid">
    <div class="info-box"><div class="lbl">الاسم الكامل</div><div class="val">${esc(user.name)}</div></div>
    <div class="info-box"><div class="lbl">البريد الإلكتروني</div><div class="val" style="font-size:8.5px">${esc(user.email)}</div></div>
    <div class="info-box"><div class="lbl">الصف الدراسي</div><div class="val">${esc(gradeLabel)}</div></div>
    <div class="info-box"><div class="lbl">رقم الهاتف</div><div class="val">${esc(user.phone || '—')}</div></div>
    <div class="info-box"><div class="lbl">هاتف ولي الأمر</div><div class="val">${esc(user.guardianPhone || '—')}</div></div>
    <div class="info-box"><div class="lbl">المدرسة</div><div class="val">${esc(user.school || '—')}</div></div>
    <div class="info-box"><div class="lbl">تاريخ التسجيل</div><div class="val">${esc(registeredDate)}</div></div>
    <div class="info-box"><div class="lbl">الحصص المفتوحة</div><div class="val">${accesses.length}</div></div>
    <div class="info-box"><div class="lbl">الواجبات المسلّمة</div><div class="val">${homeworkSubmissions.length}</div></div>
  </div>

  <!-- ══ LESSONS ══ -->
  <div class="section">📚 الحصص ووقت المشاهدة</div>
  ${accesses.length === 0
    ? '<p class="empty">لم يفتح الطالب أي حصة بعد</p>'
    : `<table>
        <thead><tr>
          <th>اسم الحصة</th>
          <th class="c" style="width:58px">المشاهدة</th>
          <th class="c" style="width:80px">درجة الامتحان</th>
          <th class="c" style="width:80px">الحالة</th>
          <th class="c" style="width:48px">المحاولات</th>
          <th class="c" style="width:72px">تاريخ الفتح</th>
        </tr></thead>
        <tbody>${lessonRows}</tbody>
      </table>`}

  <!-- ══ HOMEWORK ══ -->
  <div class="section">📝 الواجبات</div>
  ${homeworkSubmissions.length === 0
    ? '<p class="empty">لم يسلّم الطالب أي واجب بعد</p>'
    : `<table>
        <thead><tr>
          <th>اسم الواجب</th>
          <th class="c" style="width:80px">الدرجة</th>
          <th class="c" style="width:58px">النسبة</th>
          <th class="c" style="width:80px">تاريخ التسليم</th>
        </tr></thead>
        <tbody>${hwRows}</tbody>
      </table>`}

  <!-- ══ VERIFICATION (stamp + signature) ══
       Both images are Base64 data-URIs — no external request, always visible. -->
  <div class="verify-row">
    ${STAMP_B64 ? `
    <div class="stamp-box">
      <img src="${STAMP_B64}" class="stamp-img" alt="ختم YouChem">
      <div class="stamp-label">موثق من Mr.Ahmed</div>
    </div>` : ''}
    <div class="sig-box">
      ${SIGN_B64 ? `<img src="${SIGN_B64}" class="sig-img" alt="توقيع Mr.Ahmed">` : ''}
      <div class="sig-label">توقيع المعلم / المراجع</div>
    </div>
  </div>

  <!-- ══ FOOTER ══ -->
  <div class="doc-footer">
    <span>YouChem Educational Platform &mdash; منصة يوتشيم التعليمية</span>
    <span>صدر بتاريخ ${esc(generatedDate)}</span>
  </div>

</div><!-- /.page -->
</body>
</html>`;
}

/** Launch Chromium, render the HTML, return PDF bytes. */
async function renderPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    // networkidle2 lets Google Fonts finish loading without timing out on slow DNS
    await page.setContent(html, { waitUntil: 'networkidle2' as any, timeout: 30_000 });
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }));
    });
    return Buffer.from(await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    }));
  } finally {
    await browser.close();
  }
}

/** Generate a student PDF and save it to disk (fire-and-forget safe). */
async function saveStudentPdfToDisk(userId: string): Promise<void> {
  try {
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return;
    const accesses           = jsonDb.filter('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === userId);
    const homeworkSubmissions = jsonDb.filter('homeworkSubmissions', (s: DbHomeworkSubmission) => s.userId === userId);
    const lessons  = jsonDb.getAll('lessons')  as DbLesson[];
    const homeworks = jsonDb.getAll('homeworks') as DbHomework[];
    const html   = buildStudentPdfHtml(user, accesses, homeworkSubmissions, lessons, homeworks);
    const buffer = await renderPdfBuffer(html);
    const outPath = path.join(STUDENT_PDFS_DIR, `${userId}.pdf`);
    fs.writeFileSync(outPath, buffer);
    console.log(`[PDF] Saved student file: ${outPath}`);
  } catch (err: any) {
    console.error(`[PDF] Auto-save failed for ${userId}:`, err.message);
  }
}

// ── Teacher: view student file as HTML in browser ────────────────────────────
app.get('/api/youchem/student-file/:userId/view', authenticateTeacher, (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).send('<p>الطالب غير موجود</p>');

    const accesses            = jsonDb.filter('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === userId);
    const homeworkSubmissions = jsonDb.filter('homeworkSubmissions', (s: DbHomeworkSubmission) => s.userId === userId);
    const lessons   = jsonDb.getAll('lessons')   as DbLesson[];
    const homeworks = jsonDb.getAll('homeworks')  as DbHomework[];

    const html = buildStudentPdfHtml(user, accesses, homeworkSubmissions, lessons, homeworks);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('<p>فشل توليد التقرير: ' + err.message + '</p>');
  }
});

// ── Teacher: download student file as PDF ─────────────────────────────────────
app.get('/api/youchem/student-file/:userId/download', authenticateTeacher, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = jsonDb.find('users', (u: DbUser) => u.id === userId && u.role === 'student');
    if (!user) return res.status(404).json({ error: 'الطالب غير موجود' });

    const accesses            = jsonDb.filter('studentLessonAccess', (a: DbStudentLessonAccess) => a.userId === userId);
    const homeworkSubmissions = jsonDb.filter('homeworkSubmissions', (s: DbHomeworkSubmission) => s.userId === userId);
    const lessons   = jsonDb.getAll('lessons')   as DbLesson[];
    const homeworks = jsonDb.getAll('homeworks')  as DbHomework[];

    const html   = buildStudentPdfHtml(user, accesses, homeworkSubmissions, lessons, homeworks);
    const buffer = await renderPdfBuffer(html);

    // Also overwrite the saved copy so it's always current
    fs.writeFileSync(path.join(STUDENT_PDFS_DIR, `${userId}.pdf`), buffer);

    const safeName = (user.name || userId).replace(/[^a-zA-Z\u0600-\u06FF0-9 _-]/g, '').trim();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}_ملف.pdf`)}`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[PDF] Generation failed:', err.message);
    res.status(500).json({ error: 'فشل توليد الملف: ' + err.message });
  }
});

// ── Teacher: settings stats ───────────────────────────────────────────────────
app.get('/api/youchem/settings/stats', authenticateTeacher, async (req, res) => {
  try {
    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student');
    const lessons = jsonDb.getAll('lessons');
    const homeworks = jsonDb.getAll('homeworks');
    const quizzes = jsonDb.getAll('quizzes');
    const codes = jsonDb.getAll('codes') as DbCode[];
    const homeworkSubmissions = jsonDb.getAll('homeworkSubmissions');
    res.json({
      students: students.length,
      lessons: lessons.length,
      homeworks: homeworks.length,
      quizzes: quizzes.length,
      codesTotal: codes.length,
      codesUsed: codes.filter(c => c.isUsed).length,
      homeworkSubmissions: homeworkSubmissions.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: generate / fetch API key ─────────────────────────────────────────
app.post('/api/youchem/settings/api-key/generate', authenticateTeacher, (_req, res) => {
  try {
    const apiKey = randomBytes(24).toString('hex'); // 48-char hex string
    const existing = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (existing) {
      jsonDb.update('settings', (s: DbSettings) => s.id === 'main', { apiKey });
    } else {
      jsonDb.insert('settings', { id: 'main', apiKey });
    }
    res.json({ apiKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youchem/settings/api-key', authenticateTeacher, (_req, res) => {
  try {
    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    res.json({ apiKey: settings?.apiKey ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public students API (protected by apiKey query-param / Bearer header) ──────
app.get('/api/public/students', (req, res) => {
  try {
    const token =
      (req.query.apiKey as string | undefined) ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    const settings = jsonDb.find('settings', (s: DbSettings) => s.id === 'main');
    if (!token || !settings?.apiKey || token !== settings.apiKey) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student');
    const codes    = jsonDb.getAll('codes') as DbCode[];

    res.json({
      total:      students.length,
      grade2:     students.filter((s: DbUser) => s.gradeLevel === '2nd_sec').length,
      grade3:     students.filter((s: DbUser) => s.gradeLevel === '3rd_sec').length,
      codesTotal: codes.length,
      codesFree:  codes.filter((c: DbCode) => !c.isUsed).length,
      codesUsed:  codes.filter((c: DbCode) => c.isUsed).length,
      students:   students.map((s: DbUser) => ({
        name:          s.name,
        email:         s.email,
        gradeLevel:    s.gradeLevel,
        phone:         s.phone,
        guardianPhone: s.guardianPhone,
        school:        s.school,
        createdAt:     s.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: reset platform ────────────────────────────────────────────────────
app.post('/api/youchem/reset-platform', authenticateTeacher, async (req, res) => {
  try {
    // Delete all homework PDF files from disk
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, file)); } catch { /* ignore */ }
      }
    }

    // Clear all content collections (keep users + settings)
    jsonDb.remove('lessons', () => true);
    jsonDb.remove('quizzes', () => true);
    jsonDb.remove('codes', () => true);
    jsonDb.remove('studentLessonAccess', () => true);
    jsonDb.remove('homeworks', () => true);
    jsonDb.remove('homeworkSubmissions', () => true);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: homework grades matrix ──────────────────────────────────────────
app.get('/api/youchem/grades/homework', authenticateTeacher, async (req, res) => {
  try {
    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student');
    const lessons = jsonDb.getAll('lessons') as DbLesson[];
    const homeworks = jsonDb.getAll('homeworks') as DbHomework[];
    const submissions = jsonDb.getAll('homeworkSubmissions') as DbHomeworkSubmission[];
    res.json({ students, lessons, homeworks, submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Student: public leaderboard (quiz scores only, no PII) ───────────────────
app.get('/api/student/leaderboard', authenticateStudent, requireCompleteStudentProfile, async (req, res) => {
  try {
    // Only non-blocked students. Deleted students are already gone from the DB.
    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student' && !u.blocked);
    const allAccesses = jsonDb.getAll('studentLessonAccess') as DbStudentLessonAccess[];

    const ranked = students
      .map((s: DbUser) => {
        const accesses = allAccesses.filter(
          (a: DbStudentLessonAccess) => a.userId === s.id && typeof a.quizScore === 'number' && typeof a.quizTotal === 'number' && (a.quizTotal ?? 0) > 0,
        );
        const totalScore    = accesses.reduce((sum: number, a: DbStudentLessonAccess) => sum + (a.quizScore ?? 0), 0);
        const totalPossible = accesses.reduce((sum: number, a: DbStudentLessonAccess) => sum + (a.quizTotal ?? 0), 0);
        const percentage    = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
        return {
          id: s.id,
          name: s.name,
          picture: s.picture || null,
          gradeLevel: s.gradeLevel,
          totalScore,
          totalPossible,
          percentage,
          quizzesCount: accesses.length,
        };
      })
      // Only show students who have attempted at least one quiz
      .filter((s: any) => s.quizzesCount > 0)
      .sort((a: any, b: any) => b.percentage - a.percentage || b.totalScore - a.totalScore);

    res.json(ranked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Teacher: quiz grades matrix ───────────────────────────────────────────────
app.get('/api/youchem/grades/quiz', authenticateTeacher, async (req, res) => {
  try {
    const students = jsonDb.filter('users', (u: DbUser) => u.role === 'student');
    const lessons = jsonDb.getAll('lessons') as DbLesson[];
    const accesses = jsonDb.getAll('studentLessonAccess') as DbStudentLessonAccess[];
    res.json({ students, lessons, accesses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

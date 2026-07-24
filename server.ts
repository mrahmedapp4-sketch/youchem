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

// Student PDF files – saved on first registration, overwritten on each download
const STUDENT_PDFS_DIR = path.join(DATA_ROOT, 'student-pdfs');
fs.mkdirSync(STUDENT_PDFS_DIR, { recursive: true });

// Pre-load brand images as base64 once at startup (avoids repeated disk reads)
const _logoPath  = path.join(process.cwd(), 'public', 'logo.png');
const _stampPath = path.join(process.cwd(), 'attached_assets', 'image_1784762402890.png');
const LOGO_B64  = fs.existsSync(_logoPath)  ? `data:image/png;base64,${fs.readFileSync(_logoPath).toString('base64')}`  : '';
const STAMP_B64 = fs.existsSync(_stampPath) ? `data:image/png;base64,${fs.readFileSync(_stampPath).toString('base64')}` : '';
console.log(`[server] Logo loaded: ${LOGO_B64 ? 'yes' : 'NO'}, Stamp loaded: ${STAMP_B64 ? 'yes' : 'NO (path: ' + _stampPath + ')'}`);
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
        if (user && !user.blocked && user.activeSessionToken && decoded.sessionToken === user.activeSessionToken) {
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
    const user = jsonDb.find('users', (u: DbUser) => u.id === decoded.studentId);
    if (!user) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (user.blocked) {
      res.clearCookie('student_token', COOKIE_OPTS);
      return res.status(403).json({ error: 'تم حظر هذا الحساب من الدخول إلى المنصة.' });
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
    const { lessonId, questions } = req.body;
    const existing = jsonDb.find('quizzes', (q: DbQuiz) => q.lessonId === lessonId);
    if (existing) return res.status(409).json({ error: 'يوجد اختبار بالفعل لهذه الحصة — احذفه أولاً لإنشاء اختبار جديد' });
    const quiz: DbQuiz = { id: newId(), lessonId, questions, createdAt: new Date().toISOString() };
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
    const updated = jsonDb.update('users', (u: DbUser) => u.id === userId, { blocked: !user.blocked });
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

// --- STUDENT API (Google Sign-In) ---

app.post('/api/student/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken مطلوب' });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(401).json({ error: 'فشل التحقق من حساب جوجل' });

    const { sub: googleId, email, name, picture } = payload;

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
    if (sessionIsLive) {
      return res.status(403).json({ error: 'DEVICE_LOCKED' });
    }

    const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — mirrors JWT
    const sessionToken = randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    if (!user) {
      user = {
        id: newId(),
        googleId,
        name: name || 'طالب',
        email,
        picture: picture || '',
        phone: '',
        guardianPhone: '',
        school: '',
        role: 'student',
        gradeLevel: null,
        createdAt: new Date().toISOString(),
        activeSessionToken: sessionToken,
        sessionExpiresAt,
      } as DbUser;
      jsonDb.insert('users', user);
    } else {
      // Backfill googleId / update picture / set session token.
      const updates: Partial<DbUser> = { activeSessionToken: sessionToken, sessionExpiresAt };
      if (!user.googleId) updates.googleId = googleId;
      if (picture) updates.picture = picture;
      user = jsonDb.update('users', (u: DbUser) => u.id === user!.id, updates);
    }

    const token = jwt.sign(
      { role: 'student', studentId: user.id, sessionToken },
      JWT_SECRET,
      { expiresIn: '30d' },
    );
    res.cookie('student_token', token, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });

    const needsProfile = !user.name || user.name === 'طالب' || !user.phone || !user.guardianPhone || !user.school || !user.gradeLevel;
    res.json({ success: true, user, needsProfile, picture });
  } catch (err: any) {
    console.error('Google login failed:', err.message);
    res.status(401).json({ error: 'فشل تسجيل الدخول بحساب جوجل' });
  }
});

app.get('/api/student/check-auth', authenticateStudent, (req, res) => {
  const studentId = (req as any).studentId;
  const user = jsonDb.find('users', (u: DbUser) => u.id === studentId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const needsProfile = !user.name || user.name === 'طالب' || !user.phone || !user.guardianPhone || !user.school || !user.gradeLevel;
  res.json({ success: true, user, needsProfile });
});

app.post('/api/student/complete-profile', authenticateStudent, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const { name, phone, guardianPhone, school, gradeLevel } = req.body;
    if (!name || !phone || !guardianPhone || !school || !gradeLevel) {
      return res.status(400).json({ error: 'الرجاء إدخال الاسم ورقم الهاتف ورقم ولي الأمر والمدرسة والصف الدراسي' });
    }
    const updated = jsonDb.update('users', (u: DbUser) => u.id === studentId, { name, phone, guardianPhone, school, gradeLevel });
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

app.get('/api/student/lessons', authenticateStudent, async (req, res) => {
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

app.post('/api/student/validate-code', authenticateStudent, async (req, res) => {
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
app.get('/api/student/quiz/:lessonId', authenticateStudent, async (req, res) => {
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

app.post('/api/student/submit-quiz', authenticateStudent, async (req, res) => {
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
app.post('/api/student/exam/unlock', authenticateStudent, async (req, res) => {
  try {
    const { code, lessonId } = req.body;
    const studentId = (req as any).studentId;

    const key = jsonDb.find('codes', (c: DbCode) => c.codeString === (code || '').trim().toUpperCase());
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed && key.usedBy !== studentId) return res.status(400).json({ error: 'الكود مستخدم من قبل' });
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

    res.json({ quizExists: true, questions: sanitized, lessonId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy: validate code and return quiz questions (images included, answers stripped)
app.post('/api/student/exam/start', authenticateStudent, async (req, res) => {
  try {
    const { code } = req.body;
    const studentId = (req as any).studentId;

    const key = jsonDb.find('codes', (c: DbCode) => c.codeString === (code || '').trim().toUpperCase());
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed && key.usedBy !== studentId) return res.status(400).json({ error: 'الكود مستخدم من قبل' });
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
app.post('/api/student/exam/submit', authenticateStudent, async (req, res) => {
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
app.get('/api/student/homework/:homeworkId', authenticateStudent, async (req, res) => {
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

// Aggregated homework list for the student's grade, no lesson access required.
app.get('/api/student/homeworks', authenticateStudent, async (req, res) => {
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

app.post('/api/student/submit-homework', authenticateStudent, async (req, res) => {
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
app.post('/api/student/lesson-heartbeat', authenticateStudent, async (req, res) => {
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

// ── PDF helpers ───────────────────────────────────────────────────────────────

/** Build the full HTML string for a student's PDF report.
 *  Pass autoPrint=true to inject a window.print() call on load (browser-print flow). */
function buildStudentPdfHtml(
  user: DbUser,
  accesses: DbStudentLessonAccess[],
  homeworkSubmissions: DbHomeworkSubmission[],
  lessons: DbLesson[],
  homeworks: DbHomework[],
  autoPrint = false,
): string {
  const gradeLabel   = user.gradeLevel === '2nd_sec' ? 'تاني ثانوي' : user.gradeLevel === '3rd_sec' ? 'تالت ثانوي' : '—';
  const registeredDate = new Date(user.createdAt).toLocaleDateString('ar-EG');
  const generatedDate  = new Date().toLocaleDateString('ar-EG');

  const escHtml = (v: any) => String(v ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const lessonRows = accesses.map((a: DbStudentLessonAccess) => {
    const lesson = lessons.find((l: DbLesson) => l.id === a.lessonId);
    const quizCell = a.quizExempt
      ? `<span class="badge amber">معفي</span>`
      : a.quizTotal != null
        ? `<span class="badge ${a.quizPassed ? 'green' : 'red'}">${a.quizScore}/${a.quizTotal}</span>`
        : `<span class="muted">—</span>`;
    const passedCell = a.quizPassed
      ? '<span style="color:#15803d;font-weight:700">✓ اجتاز</span>'
      : a.quizExempt
      ? '<span style="color:#92400e;font-weight:700">معفي</span>'
      : a.lessonLocked
      ? '<span style="color:#b91c1c;font-weight:700">🔒 مقفول</span>'
      : a.quizTotal == null
      ? '<span style="color:#64748b;font-weight:700">لا يوجد امتحان</span>'
      : '<span style="color:#b91c1c;font-weight:700">✗ لم يجتز</span>';
    const attemptsCell = a.quizAttempts != null
      ? `<span class="muted">${a.quizAttempts}</span>`
      : `<span class="muted">—</span>`;
    return `<tr>
      <td>${escHtml(lesson?.title || a.lessonId)}</td>
      <td class="center">${a.viewingMinutes || 0} د</td>
      <td class="center">${quizCell}</td>
      <td class="center">${passedCell}</td>
      <td class="center">${attemptsCell}</td>
      <td class="center muted">${new Date(a.unlockedAt).toLocaleDateString('ar-EG')}</td>
    </tr>`;
  }).join('');

  const hwRows = homeworkSubmissions.map((s: DbHomeworkSubmission) => {
    const hw  = homeworks.find((h: DbHomework) => h.id === s.homeworkId);
    const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
    return `<tr>
      <td>${escHtml(hw?.title || s.homeworkId)}</td>
      <td class="center"><span class="badge ${pct >= 50 ? 'green' : 'red'}">${s.score}/${s.total}</span></td>
      <td class="center">${pct}%</td>
      <td class="center muted">${new Date(s.createdAt).toLocaleDateString('ar-EG')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
    direction: rtl;
    unicode-bidi: bidi-override;
    color: #1e293b;
    background: #ffffff;
    font-size: 11.5px;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page wrapper: all normal flow, nothing fixed ── */
  .page {
    padding: 28px 36px 32px;
    min-width: 600px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #1e3a8a;
    padding-bottom: 14px;
    margin-bottom: 18px;
    gap: 12px;
  }
  .header-logos { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .header-logo  { height: 60px; width: auto; object-fit: contain; }
  .header-stamp { height: 80px; width: auto; object-fit: contain; mix-blend-mode: multiply; }
  .header-center { text-align: center; flex: 1; }
  .header-center h1 { font-size: 19px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.3px; }
  .header-center p  { font-size: 10px; color: #64748b; margin-top: 3px; }
  .header-right { font-size: 9.5px; color: #94a3b8; text-align: right; white-space: nowrap; }

  /* ── Section banner ── */
  .section-title {
    background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%);
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 7px;
    margin: 16px 0 9px;
    letter-spacing: 0.2px;
  }

  /* ── Profile 3-column grid ── */
  .profile-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .info-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 7px 11px;
    overflow: hidden;
  }
  .info-box .lbl { font-size: 8.5px; color: #94a3b8; letter-spacing: 0.4px; text-transform: uppercase; }
  .info-box .val { font-size: 11.5px; font-weight: 700; color: #1e293b; margin-top: 1px; word-break: break-all; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #eff6ff; }
  thead th {
    padding: 7px 11px;
    font-weight: 700;
    color: #1e40af;
    text-align: right;
    border-bottom: 2px solid #bfdbfe;
    white-space: nowrap;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: #f0f9ff; }
  tbody td { padding: 6px 11px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .center { text-align: center !important; }
  .muted  { color: #94a3b8; }
  .empty-note { color: #94a3b8; font-style: italic; padding: 10px 0; text-align: center; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 10px;
    white-space: nowrap;
  }
  .badge.green { background: #dcfce7; color: #15803d; }
  .badge.red   { background: #fee2e2; color: #b91c1c; }
  .badge.amber { background: #fef3c7; color: #92400e; }

  /* ── Verification row (stamp + signature) — NORMAL FLOW, not fixed ── */
  .verify-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px dashed #cbd5e1;
    gap: 16px;
  }
  .verify-stamp-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .verify-stamp {
    width: 130px;
    height: 130px;
    object-fit: contain;
  }
  .verify-stamp-label {
    font-size: 11px;
    font-weight: 700;
    color: #1e3a8a;
    text-align: center;
  }
  .verify-sig {
    flex: 1;
    text-align: center;
    padding-bottom: 8px;
  }
  .verify-sig .sig-line {
    border-bottom: 1.5px solid #334155;
    width: 70%;
    margin: 0 auto 6px;
    height: 32px;
  }
  .verify-sig .sig-label { font-size: 10px; color: #64748b; }

  /* ── Footer — NORMAL FLOW, always below all content ── */
  .doc-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 9px;
    color: #94a3b8;
  }
</style>
${autoPrint ? `<script>window.addEventListener('load', function(){ window.print(); });</script>` : ''}
</head>
<body>
<div class="page">

  <!-- ── Header ── -->
  <div class="header">
    <div class="header-logos">
      ${LOGO_B64 ? `<img src="${LOGO_B64}" class="header-logo" alt="YouChem">` : ''}
    </div>
    <div class="header-center">
      <h1>ملف الطالب</h1>
      <p>منصة يوتشيم التعليمية &mdash; YouChem Educational Platform</p>
    </div>
    <div class="header-right">تاريخ الإصدار<br><strong>${escHtml(generatedDate)}</strong></div>
  </div>

  <!-- ── Profile ── -->
  <div class="section-title">&#x1F4CB; بيانات الطالب</div>
  <div class="profile-grid">
    <div class="info-box"><div class="lbl">الاسم الكامل</div><div class="val">${escHtml(user.name)}</div></div>
    <div class="info-box"><div class="lbl">البريد الإلكتروني</div><div class="val" style="font-size:9.5px">${escHtml(user.email)}</div></div>
    <div class="info-box"><div class="lbl">الصف الدراسي</div><div class="val">${escHtml(gradeLabel)}</div></div>
    <div class="info-box"><div class="lbl">رقم الهاتف</div><div class="val">${escHtml(user.phone || '—')}</div></div>
    <div class="info-box"><div class="lbl">هاتف ولي الأمر</div><div class="val">${escHtml(user.guardianPhone || '—')}</div></div>
    <div class="info-box"><div class="lbl">المدرسة</div><div class="val">${escHtml(user.school || '—')}</div></div>
    <div class="info-box"><div class="lbl">تاريخ التسجيل</div><div class="val">${escHtml(registeredDate)}</div></div>
    <div class="info-box"><div class="lbl">الحصص المفتوحة</div><div class="val">${accesses.length}</div></div>
    <div class="info-box"><div class="lbl">الواجبات المسلّمة</div><div class="val">${homeworkSubmissions.length}</div></div>
  </div>

  <!-- ── Lessons ── -->
  <div class="section-title">&#x1F4DA; الحصص ووقت المشاهدة</div>
  ${accesses.length === 0
    ? '<p class="empty-note">لم يفتح الطالب أي حصة بعد</p>'
    : `<table>
        <thead><tr>
          <th>اسم الحصة</th>
          <th style="width:80px" class="center">وقت المشاهدة</th>
          <th style="width:100px" class="center">درجة الامتحان</th>
          <th style="width:90px" class="center">الحالة</th>
          <th style="width:55px" class="center">المحاولات</th>
          <th style="width:85px" class="center">تاريخ الفتح</th>
        </tr></thead>
        <tbody>${lessonRows}</tbody>
      </table>`}

  <!-- ── Homework ── -->
  <div class="section-title">&#x1F4DD; الواجبات</div>
  ${homeworkSubmissions.length === 0
    ? '<p class="empty-note">لم يسلّم الطالب أي واجب بعد</p>'
    : `<table>
        <thead><tr>
          <th>اسم الواجب</th>
          <th style="width:100px" class="center">الدرجة</th>
          <th style="width:70px" class="center">النسبة</th>
          <th style="width:100px" class="center">تاريخ التسليم</th>
        </tr></thead>
        <tbody>${hwRows}</tbody>
      </table>`}

  <!-- ── Verification row (stamp + signature) ── -->
  <div class="verify-row">
    ${STAMP_B64 ? `
    <div class="verify-stamp-box">
      <img src="${STAMP_B64}" class="verify-stamp" alt="YouChem Stamp">
      <div class="verify-stamp-label">موثق من Mr.Ahmed</div>
    </div>` : ''}
    <div class="verify-sig">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المعلم / المراجع</div>
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="doc-footer">
    <span>YouChem Educational Platform &mdash; منصة يوتشيم التعليمية</span>
    <span>صدر بتاريخ ${escHtml(generatedDate)}</span>
  </div>

</div>
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
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30_000 });
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
    const codes = jsonDb.getAll('codes') as Array<{ used?: boolean }>;
    const homeworkSubmissions = jsonDb.getAll('homeworkSubmissions');
    res.json({
      students: students.length,
      lessons: lessons.length,
      homeworks: homeworks.length,
      quizzes: quizzes.length,
      codesTotal: codes.length,
      codesUsed: codes.filter(c => c.used).length,
      homeworkSubmissions: homeworkSubmissions.length,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

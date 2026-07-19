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
    : path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads', 'homeworks');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
console.log(`[server] Using uploads directory: ${UPLOADS_DIR}`);
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
    const { count } = req.body;
    for (let i = 0; i < count; i++) {
      const code: DbCode = {
        id: newId(),
        codeString: `YCH-${randomBytes(4).toString('hex').toUpperCase()}`,
        isUsed: false,
        usedBy: null,
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
      const updated = jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === userId && a.lessonId === lessonId,
        { quizExempt: !access.quizExempt }
      );
      res.json(updated);
    } else {
      const inserted: DbStudentLessonAccess = {
        userId,
        lessonId,
        unlockedAt: new Date().toISOString(),
        quizPassed: false,
        quizExempt: true,
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
  // Clear the active session in the DB so the student can log in again from
  // any device.
  // Use { ignoreExpiration: true } so a 30-day-old (expired) but authentic
  // cookie can still trigger a clean logout — unlike jwt.decode() this still
  // verifies the signature, so forged tokens are rejected.
  // Only clear the DB session when the token's sessionToken matches the
  // current activeSessionToken, to prevent a stale/old cookie from wiping a
  // different device's live session.
  try {
    const token = req.cookies.student_token;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;
      if (decoded?.studentId && decoded?.sessionToken) {
        const user = jsonDb.find('users', (u: DbUser) => u.id === decoded.studentId);
        if (user && user.activeSessionToken === decoded.sessionToken) {
          jsonDb.update(
            'users',
            (u: DbUser) => u.id === decoded.studentId,
            { activeSessionToken: null, sessionExpiresAt: null } as any,
          );
        }
      }
    }
  } catch {
    // ignore malformed/forged token — still clear the cookie
  }
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
    if (existing) {
      jsonDb.update(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId,
        { quizPassed: passed || existing.quizPassed, quizScore: score, quizTotal: total, quizResults: results }
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

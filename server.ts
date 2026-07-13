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

// Teacher login password lives only in the TEACHER_PASSWORD secret, never in
// source. We hash it once at startup and compare hashes on every login
// attempt instead of hashing the plaintext on every request.
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD;
if (!TEACHER_PASSWORD) {
  throw new Error('TEACHER_PASSWORD secret must be set for teacher login.');
}
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

// Homework PDFs are stored on disk under data/uploads (gitignored, contains
// no student PII by itself) and served back as static files.
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads', 'homeworks');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads/homeworks', express.static(UPLOADS_DIR));

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

// Authentication Middleware
const authenticateTeacher = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.teacher_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'teacher') throw new Error();
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateStudent = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.student_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'student') throw new Error();
    (req as any).studentId = decoded.studentId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- TEACHER API ---
app.post('/api/teacher/login', async (req, res) => {
  const { password } = req.body;
  const isMatch = typeof password === 'string' && await bcrypt.compare(password, await teacherPasswordHashPromise);
  if (isMatch) {
    const token = jwt.sign({ role: 'teacher' }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('teacher_token', token, { httpOnly: true }).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/teacher/check-auth', authenticateTeacher, (req, res) => {
  res.json({ success: true });
});

app.post('/api/teacher/logout', (req, res) => {
  res.clearCookie('teacher_token').json({ success: true });
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
    const isFree = platform === 'youtube';
    const lesson: DbLesson = {
      id: newId(),
      title,
      gradeLevel,
      platform,
      videoUrl,
      isFree,
      isHidden: false,
      createdAt: new Date().toISOString(),
    };
    jsonDb.insert('lessons', lesson);
    res.json(lesson);
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

    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.lessonId === id);
    if (homework) {
      const filePath = path.join(UPLOADS_DIR, path.basename(homework.pdfUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      jsonDb.remove('homeworkSubmissions', (s: DbHomeworkSubmission) => s.homeworkId === homework.id);
    }
    jsonDb.remove('homeworks', (h: DbHomework) => h.lessonId === id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Codes API
app.get('/api/youchem/codes', authenticateTeacher, async (req, res) => {
  try {
    res.json(jsonDb.getAll('codes'));
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
    const quiz: DbQuiz = { id: newId(), lessonId, questions, createdAt: new Date().toISOString() };
    jsonDb.insert('quizzes', quiz);
    res.json(quiz);
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
    const { lessonId, numQuestions, answerKey } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'ملف PDF مطلوب' });

    const parsedAnswerKey = JSON.parse(answerKey);
    const parsedNumQuestions = parseInt(numQuestions, 10);
    if (!Array.isArray(parsedAnswerKey) || parsedAnswerKey.length !== parsedNumQuestions) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'عدد الأسئلة لا يطابق نموذج الإجابة' });
    }

    // Only one homework per lesson: replace any previous one (and its file).
    const existing = jsonDb.find('homeworks', (h: DbHomework) => h.lessonId === lessonId);
    if (existing) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(existing.pdfUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      jsonDb.remove('homeworks', (h: DbHomework) => h.id === existing.id);
      jsonDb.remove('homeworkSubmissions', (s: DbHomeworkSubmission) => s.homeworkId === existing.id);
    }

    const homework: DbHomework = {
      id: newId(),
      lessonId,
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
    if (!user) {
      user = {
        id: newId(),
        googleId,
        name: name || 'طالب',
        email,
        phone: '',
        school: '',
        role: 'student',
        gradeLevel: null,
        createdAt: new Date().toISOString(),
      } as DbUser;
      jsonDb.insert('users', user);
    } else if (!user.googleId) {
      // Backfill googleId for a user record that predates Google sign-in.
      user = jsonDb.update('users', (u: DbUser) => u.id === user!.id, { googleId });
    }

    const token = jwt.sign({ role: 'student', studentId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('student_token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const needsProfile = !user.phone || !user.school || !user.gradeLevel;
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
  const needsProfile = !user.phone || !user.school || !user.gradeLevel;
  res.json({ success: true, user, needsProfile });
});

app.post('/api/student/complete-profile', authenticateStudent, async (req, res) => {
  try {
    const studentId = (req as any).studentId;
    const { phone, school, gradeLevel } = req.body;
    if (!phone || !school || !gradeLevel) {
      return res.status(400).json({ error: 'الرجاء إدخال رقم الهاتف والمدرسة والصف الدراسي' });
    }
    const updated = jsonDb.update('users', (u: DbUser) => u.id === studentId, { phone, school, gradeLevel });
    if (!updated) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/logout', (req, res) => {
  res.clearCookie('student_token').json({ success: true });
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
      options: q.options,
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
    let results: Array<{ question: string; options: string[]; studentAnswer: string | null; correctAnswer: string; isCorrect: boolean }> = [];

    if (quiz && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      total = quiz.questions.length;
      results = quiz.questions.map((q: any, idx: number) => {
        const studentAnswer = answers?.[idx] !== undefined ? answers[idx] : null;
        const isCorrect = studentAnswer !== null && studentAnswer === q.correct_answer;
        if (isCorrect) score++;
        return {
          question: q.question,
          options: q.options,
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

    if (passed) {
      const existing = jsonDb.find(
        'studentLessonAccess',
        (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId
      );
      if (existing) {
        jsonDb.update(
          'studentLessonAccess',
          (a: DbStudentLessonAccess) => a.userId === studentId && a.lessonId === lessonId,
          { quizPassed: true }
        );
      } else {
        jsonDb.insert('studentLessonAccess', {
          userId: studentId,
          lessonId,
          unlockedAt: new Date().toISOString(),
          quizPassed: true,
          quizExempt: false,
        });
      }
    }

    res.json({ score, total, passed, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Homework: fetch the PDF + question count for a lesson, without the answer key.
app.get('/api/student/homework/:lessonId', authenticateStudent, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.lessonId === lessonId);
    if (!homework) return res.json({ homework: null });
    res.json({
      homework: {
        id: homework.id,
        pdfUrl: homework.pdfUrl,
        pdfFileName: homework.pdfFileName,
        numQuestions: homework.numQuestions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/submit-homework', authenticateStudent, async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    const studentId = (req as any).studentId;

    const homework = jsonDb.find('homeworks', (h: DbHomework) => h.lessonId === lessonId);
    if (!homework) return res.status(404).json({ error: 'لا يوجد واجب لهذا الدرس' });
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
      lessonId,
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

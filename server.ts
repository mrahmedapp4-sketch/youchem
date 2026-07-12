import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db';
import { users, lessons, quizzes, codes, studentLessonAccess } from './src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Mock DB wrapper for safe startup
const safeDbSelect = async (table: any, where?: any) => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Using mock empty data.');
    return [];
  }
  let query = db.select().from(table);
  if (where) query = query.where(where) as any;
  return await query;
};


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
  const isMatch = await bcrypt.compare(password, await bcrypt.hash('port5', 10));
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
    const allLessons = await safeDbSelect(lessons);
    res.json(allLessons);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/lessons', authenticateTeacher, async (req, res) => {
  try {
    const { title, gradeLevel, platform, videoUrl } = req.body;
    const isFree = platform === 'youtube';
    const [lesson] = await db.insert(lessons).values({
      title, gradeLevel, platform, videoUrl, isFree, isHidden: false
    }).returning();
    res.json(lesson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/lessons/:id/toggle-visibility', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    
    const [updated] = await db.update(lessons)
      .set({ isHidden: !lesson.isHidden })
      .where(eq(lessons.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/lessons/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(lessons).where(eq(lessons.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Codes API
app.get('/api/youchem/codes', authenticateTeacher, async (req, res) => {
  try {
    const allCodes = await safeDbSelect(codes);
    res.json(allCodes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/codes/generate', authenticateTeacher, async (req, res) => {
  try {
    const { count } = req.body;
    const newCodes = [];
    for (let i = 0; i < count; i++) {
      newCodes.push({ codeString: `YCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}` });
    }
    await db.insert(codes).values(newCodes);
    res.json({ success: true, generated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/youchem/codes/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(codes).where(eq(codes.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Quizzes API
app.get('/api/youchem/quizzes', authenticateTeacher, async (req, res) => {
  try {
    const allQuizzes = await safeDbSelect(quizzes);
    res.json(allQuizzes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youchem/quizzes', authenticateTeacher, async (req, res) => {
  try {
    const { lessonId, questions } = req.body;
    const [quiz] = await db.insert(quizzes).values({ lessonId, questions }).returning();
    res.json(quiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Students & Exemptions API
app.get('/api/youchem/students', authenticateTeacher, async (req, res) => {
  try {
    // Basic implementation for now: fetch all students
    const allStudents = await safeDbSelect(users, eq(users.role, 'student'));
    // Need lesson accesses too
    const allAccesses = await safeDbSelect(studentLessonAccess);
    
    const studentsWithAccess = allStudents.map((s: any) => ({
      ...s,
      accesses: allAccesses.filter((a: any) => a.userId === s.id)
    }));
    
    res.json(studentsWithAccess);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/youchem/students/:userId/lessons/:lessonId/exempt', authenticateTeacher, async (req, res) => {
  try {
    const { userId, lessonId } = req.params;
    const [access] = await db.select().from(studentLessonAccess)
      .where(and(eq(studentLessonAccess.userId, userId), eq(studentLessonAccess.lessonId, lessonId)));
      
    if (access) {
      const [updated] = await db.update(studentLessonAccess)
        .set({ quizExempt: !access.quizExempt })
        .where(and(eq(studentLessonAccess.userId, userId), eq(studentLessonAccess.lessonId, lessonId)))
        .returning();
      res.json(updated);
    } else {
      // Create it if it doesn't exist
      const [inserted] = await db.insert(studentLessonAccess).values({
        userId,
        lessonId,
        quizPassed: false,
        quizExempt: true
      }).returning();
      res.json(inserted);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- STUDENT API ---
// Note: We bypass strict login for development as requested. 
// We will mock a user ID for student routes for now.
const getMockUserId = async () => {
  let [user] = await db.select().from(users).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ name: 'Test Student', email: 'student@test.com' }).returning();
  }
  return user.id;
};

app.post('/api/student/set-grade', async (req, res) => {
  try {
    const { gradeLevel } = req.body;
    const userId = await getMockUserId(); // Dev mode bypass
    
    await db.update(users)
      .set({ gradeLevel })
      .where(eq(users.id, userId));
      
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/lessons', async (req, res) => {
  try {
    const userId = await getMockUserId();
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.gradeLevel) return res.status(400).json({ error: 'Grade not set' });
    
    // SERVER ACTION: Fetch visible lessons for student's grade
    const availableLessons = await safeDbSelect(lessons, and(
      eq(lessons.gradeLevel, user.gradeLevel),
      eq(lessons.isHidden, false)
    ));
    
    const accesses = await safeDbSelect(studentLessonAccess, eq(studentLessonAccess.userId, userId));
    
    res.json({ lessons: availableLessons, accesses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/validate-code', async (req, res) => {
  try {
    const { lessonId, code } = req.body;
    const userId = await getMockUserId(); // Dev mode bypass
    
    const [key] = await db.select().from(codes).where(eq(codes.codeString, code));
    if (!key) return res.status(400).json({ error: 'الكود غير صحيح' });
    if (key.isUsed) return res.status(400).json({ error: 'الكود مستخدم من قبل' });
    
    // Mark code as used
    await db.update(codes).set({ isUsed: true, usedBy: userId }).where(eq(codes.id, key.id));
    
    // Grant access
    await db.insert(studentLessonAccess).values({
      userId,
      lessonId,
      quizPassed: false,
      quizExempt: false
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student/submit-quiz', async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    const userId = await getMockUserId(); // Dev mode bypass
    
    // Hardcoded logic for now, or fetch from `quizzes` table
    let score = 0;
    // Assuming answers is an array of strings, we'll just mock a pass if they answer everything
    if (answers && answers.length >= 5) score = 10; 
    
    if (score >= 5) {
      await db.update(studentLessonAccess)
        .set({ quizPassed: true })
        .where(and(eq(studentLessonAccess.userId, userId), eq(studentLessonAccess.lessonId, lessonId)));
    }
    
    res.json({ score, passed: score >= 5 });
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

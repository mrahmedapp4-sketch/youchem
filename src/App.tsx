import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { TeacherAuthGuard } from './components/TeacherAuthGuard';
import { Codes } from './pages/dashboard/Codes';
import { UploadVideo } from './pages/dashboard/Upload';
import { Quizzes } from './pages/dashboard/Quizzes';
import { Homework } from './pages/dashboard/Homework';
import { Students } from './pages/dashboard/Students';
import { Emails } from './pages/dashboard/Emails';
import { HomeworkGrades } from './pages/dashboard/HomeworkGrades';
import { QuizGrades } from './pages/dashboard/QuizGrades';
import { TeacherLogin } from './pages/TeacherLogin';
import { StudentDashboard } from './pages/StudentDashboard';
import { LessonView } from './pages/LessonView';
import { GradeSelection } from './pages/GradeSelection';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* STUDENT FLOW */}
        <Route path="/" element={<GradeSelection />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/lessons/:id" element={<LessonView />} />
        
        {/* TEACHER FLOW */}
        <Route path="/youchem/login" element={<TeacherLogin />} />
        
        <Route path="/youchem" element={<TeacherAuthGuard />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Navigate to="/youchem/upload" replace />} />
            <Route path="codes" element={<Codes />} />
            <Route path="upload" element={<UploadVideo />} />
            <Route path="quizzes" element={<Quizzes />} />
            <Route path="homework" element={<Homework />} />
            <Route path="students" element={<Students />} />
            <Route path="emails" element={<Emails />} />
            <Route path="grades/homework" element={<HomeworkGrades />} />
            <Route path="grades/quiz" element={<QuizGrades />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

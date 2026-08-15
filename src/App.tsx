import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { TeacherAuthGuard } from './components/TeacherAuthGuard';
import { Codes } from './pages/dashboard/Codes';
import { UploadVideo } from './pages/dashboard/Upload';
import { Quizzes } from './pages/dashboard/Quizzes';
import { Homework } from './pages/dashboard/Homework';
import { Students } from './pages/dashboard/Students';
import { Emails } from './pages/dashboard/Emails';
import { StudentFiles } from './pages/dashboard/StudentFiles';
import { TeacherFiles } from './pages/dashboard/Files';
import { HomeworkView } from './pages/HomeworkView';
import { Settings } from './pages/dashboard/Settings';
import { TeacherLogin } from './pages/TeacherLogin';
import { StudentProfileGuard } from './components/StudentProfileGuard';
import { StudentDashboard } from './pages/StudentDashboard';
import { LessonView } from './pages/LessonView';
import { GradeSelection } from './pages/GradeSelection';
import { ExamPage } from './pages/ExamPage';
import { ManualGrades } from './pages/dashboard/ManualGrades';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* STUDENT FLOW */}
        <Route path="/" element={<GradeSelection />} />
        <Route path="/exam" element={<Navigate to="/student-dashboard" replace />} />
        <Route element={<StudentProfileGuard />}>
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/lessons/:id" element={<LessonView />} />
          <Route path="/homework/:id" element={<HomeworkView />} />
        </Route>
        
        {/* TEACHER FLOW */}
        <Route path="/youchem/login" element={<TeacherLogin />} />
        
        <Route path="/youchem" element={<TeacherAuthGuard />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Navigate to="/youchem/upload" replace />} />
            <Route path="codes" element={<Codes />} />
            <Route path="upload" element={<UploadVideo />} />
            <Route path="quizzes" element={<Quizzes />} />
            <Route path="grades" element={<ManualGrades />} />
            <Route path="homework" element={<Homework />} />
            <Route path="students" element={<Students />} />
            <Route path="emails" element={<Emails />} />
            <Route path="files" element={<TeacherFiles />} />
            <Route path="student-files" element={<StudentFiles />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

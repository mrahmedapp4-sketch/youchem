CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE grade_level AS ENUM ('2nd_sec', '3rd_sec');
CREATE TYPE platform_type AS ENUM ('youtube', 'vimeo');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role DEFAULT 'student' NOT NULL,
  grade_level grade_level,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  grade_level grade_level NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) NOT NULL,
  title VARCHAR(255) NOT NULL,
  grade_level grade_level NOT NULL,
  platform platform_type NOT NULL,
  video_url VARCHAR(255) NOT NULL,
  is_free BOOLEAN DEFAULT FALSE NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_string VARCHAR(255) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE NOT NULL,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE student_lesson_access (
  user_id UUID REFERENCES users(id) NOT NULL,
  lesson_id UUID REFERENCES lessons(id) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  quiz_passed BOOLEAN DEFAULT FALSE NOT NULL,
  quiz_exempt BOOLEAN DEFAULT FALSE NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

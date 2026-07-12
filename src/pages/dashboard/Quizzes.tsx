import { useState, useEffect, FormEvent } from 'react';

export function Quizzes() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  
  // Array of 10 questions
  const [questions, setQuestions] = useState(
    Array(10).fill({ question: '', options: ['', '', '', ''], correct_answer: '0' })
  );

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) {
        const allLessons = await res.json();
        setLessons(allLessons);
        if (allLessons.length > 0) setSelectedLesson(allLessons[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setQuestions(newQs);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQs = [...questions];
    const newOptions = [...newQs[qIndex].options];
    newOptions[oIndex] = value;
    newQs[qIndex] = { ...newQs[qIndex], options: newOptions };
    setQuestions(newQs);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return alert('الرجاء اختيار حصة');
    try {
      // SERVER ACTION: Save Quiz
      const res = await fetch('/api/youchem/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: selectedLesson, questions })
      });
      if (res.ok) {
        alert('تم حفظ الاختبار بنجاح');
        setQuestions(Array(10).fill({ question: '', options: ['', '', '', ''], correct_answer: '0' }));
      }
    } catch (err) {
      alert('خطأ في حفظ الاختبار');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">إدارة الاختبارات (Quizzes)</h1>
        <p className="text-slate-500 mt-1">إنشاء 10 أسئلة لكل حصة (خاص بحصص Vimeo)</p>
      </div>
      
      <form onSubmit={handleSaveQuiz} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">اختر الحصة</label>
          <select 
            value={selectedLesson} 
            onChange={e => setSelectedLesson(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
            required
          >
            {lessons.map(l => (
              <option key={l.id} value={l.id}>{l.title} ({l.platform})</option>
            ))}
          </select>
        </div>

        <div className="space-y-12">
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800">السؤال رقم {qIndex + 1}</h3>
              <input 
                type="text" 
                placeholder="نص السؤال..." 
                required
                value={q.question}
                onChange={e => updateQuestion(qIndex, 'question', e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-300"
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map(oIndex => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name={`q-${qIndex}-correct`} 
                      value={oIndex.toString()}
                      checked={q.correct_answer === oIndex.toString()}
                      onChange={e => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <input 
                      type="text" 
                      placeholder={`الخيار ${oIndex + 1}`}
                      required
                      value={q.options[oIndex]}
                      onChange={e => updateOption(qIndex, oIndex, e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button type="submit" className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
            حفظ الاختبار
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';

// All question images are normalized to this fixed size on upload, so every
// question looks identical (same crop/proportions) on mobile, tablet and desktop.
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 450;

const resizeImageToFixedDimensions = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = IMAGE_WIDTH;
        canvas.height = IMAGE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        const scale = Math.min(IMAGE_WIDTH / img.width, IMAGE_HEIGHT / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (IMAGE_WIDTH - w) / 2;
        const y = (IMAGE_HEIGHT - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
};

export function Quizzes() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  
  // Array of 10 questions
  const [questions, setQuestions] = useState(
    Array(10).fill({ question: '', options: ['', '', '', ''], correct_answer: '0', image: '' })
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
        setQuestions(Array(10).fill({ question: '', options: ['', '', '', ''], correct_answer: '0', image: '' }));
      }
    } catch (err) {
      alert('خطأ في حفظ الاختبار');
    }
  };

  const handleImageChange = async (qIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('الرجاء اختيار صورة بصيغة PNG أو JPG فقط');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، الرجاء اختيار صورة أصغر من 5 ميجابايت');
      return;
    }
    try {
      const dataUrl = await resizeImageToFixedDimensions(file);
      updateQuestion(qIndex, 'image', dataUrl);
    } catch (err) {
      alert('تعذر معالجة الصورة');
    }
  };

  const handleRemoveImage = (qIndex: number) => {
    updateQuestion(qIndex, 'image', '');
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

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">صورة السؤال (اختياري)</label>
                {q.image ? (
                  <div className="relative w-full max-w-md">
                    <div className="w-full aspect-video bg-white rounded-xl overflow-hidden border border-slate-300">
                      <img src={q.image} alt={`صورة السؤال ${qIndex + 1}`} className="w-full h-full object-contain" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(qIndex)}
                      className="absolute -top-2 -left-2 bg-red-600 text-white rounded-full p-1.5 shadow-sm hover:bg-red-700 transition-colors"
                      title="حذف الصورة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full max-w-md aspect-video border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <ImagePlus className="w-6 h-6 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-500">إضافة صورة PNG أو JPG</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      onChange={e => handleImageChange(qIndex, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
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

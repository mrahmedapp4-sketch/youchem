interface QuizAnswerReviewProps {
  options?: string[] | null;
  studentAnswer: string | null;
  correctAnswer: string;
  studentLabel: string;
  correctLabel: string;
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizAnswerReview({
  options,
  studentAnswer,
  correctAnswer,
  studentLabel,
  correctLabel,
}: QuizAnswerReviewProps) {
  const displayAnswer = (answer: string | null) => {
    if (!answer) return '—';
    const optionText = options?.[ANSWER_LETTERS.indexOf(answer)];
    return optionText ? `${answer}. ${optionText}` : answer;
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <p className="text-slate-700"><span className="font-bold">{studentLabel}</span> {displayAnswer(studentAnswer)}</p>
        <p className="text-emerald-700"><span className="font-bold">{correctLabel}</span> {displayAnswer(correctAnswer)}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ANSWER_LETTERS.map((letter, index) => {
          const isStudentAnswer = studentAnswer === letter;
          const isCorrectAnswer = correctAnswer === letter;
          const optionText = options?.[index];

          return (
            <div
              key={letter}
              className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 ${
                isCorrectAnswer
                  ? 'border-emerald-300 bg-emerald-50'
                  : isStudentAnswer
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                isCorrectAnswer ? 'bg-emerald-600 text-white' : isStudentAnswer ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {letter}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {optionText || letter}
                </p>
                {(isStudentAnswer || isCorrectAnswer) && (
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] font-bold">
                    {isStudentAnswer && <span className="text-red-700">{studentLabel}</span>}
                    {isCorrectAnswer && <span className="text-emerald-700">{correctLabel}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

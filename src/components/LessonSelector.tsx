import type { Lesson, LessonId } from '../types'

interface LessonSelectorProps {
  lessons: Lesson[]
  selectedId: LessonId
  attemptCounts: Partial<Record<LessonId, number>>
  onSelect: (id: LessonId) => void
}

export function LessonSelector({ lessons, selectedId, attemptCounts, onSelect }: LessonSelectorProps) {
  return (
    <nav aria-labelledby="lessons-heading" className="card p-4 sm:p-4">
      <h2 id="lessons-heading" className="eyebrow px-2 pb-3">
        Lessons
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {lessons.map((lesson) => {
          const selected = lesson.id === selectedId
          const attempts = attemptCounts[lesson.id] ?? 0
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => onSelect(lesson.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full flex-col items-start rounded-[20px] px-4 py-3 text-left transition-[background-color,box-shadow] duration-200 ${
                  selected
                    ? 'bg-sage-soft/85 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.9),0_0_0_1.5px_var(--color-sage),0_6px_16px_-8px_rgb(42_92_65/0.45)]'
                    : 'bg-white/40 shadow-[inset_0_1px_0.5px_rgb(255_255_255/0.8)] hover:bg-white/70'
                }`}
              >
                <span className="text-xl font-extrabold" lang="en-US">
                  {lesson.text}
                </span>
                <span className="text-sm text-ink-soft">{lesson.target.label}</span>
                {attempts > 0 && (
                  <span className="mt-1 text-xs font-bold text-sage-dark">
                    {attempts} {attempts === 1 ? 'attempt' : 'attempts'} this session
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

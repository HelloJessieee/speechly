import type { Lesson } from '../types'
import { Icon } from './Icon'

export function LessonGuide({ lesson }: { lesson: Lesson }) {
  return (
    <section aria-labelledby="guide-heading" className="card flex flex-col gap-4">
      <h2 id="guide-heading" className="eyebrow">
        How to say “{lesson.text}”
      </h2>
      <p className="text-lg leading-relaxed">{lesson.explanation}</p>
      <p className="rounded-[20px] bg-sage-soft/70 p-4">
        <span className="font-bold text-sage-dark">Tip: </span>
        {lesson.tip}
      </p>
      {lesson.note && (
        <p className="flex gap-3 rounded-[20px] bg-white/45 p-4 text-sm leading-relaxed">
          <Icon name="info" className="mt-0.5 size-5 text-sky" />
          <span>{lesson.note}</span>
        </p>
      )}
    </section>
  )
}

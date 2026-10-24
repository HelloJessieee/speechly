import SwiftUI

struct ContentView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    LessonPicker()
                    StepsBar(current: model.currentStep)
                    if sizeClass == .regular {
                        HStack(alignment: .top, spacing: 20) {
                            VStack(spacing: 20) { ReferenceCard().id("reference"); LessonGuideCard() }
                            VStack(spacing: 20) { PracticeCard().id("practice"); FeedbackCard() }
                        }
                    } else {
                        ReferenceCard().id("reference")
                        LessonGuideCard()
                        PracticeCard().id("practice")
                        FeedbackCard()
                    }
                    Text("MouthCoach is a practice aid for language learners. It does not diagnose or treat any condition, illustrations are simplified, and recordings stay on your device unless you ask for Claude feedback.")
                        .font(.footnote)
                        .foregroundStyle(Color.mcInkSoft)
                }
                .padding(16)
                .frame(maxWidth: 1100)
                .frame(maxWidth: .infinity)
            }
            .onChange(of: model.animationMode) { _, mode in
                if mode == .correction { withAnimation { proxy.scrollTo("reference", anchor: .top) } }
            }
        }
        .background(BackdropView())
        .foregroundStyle(Color.mcInk)
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "mouth.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Color.mcSage, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("MouthCoach").font(.title2.bold())
                Text("Practice American English pronunciation with visual guidance.")
                    .font(.subheadline)
                    .foregroundStyle(Color.mcInkSoft)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(cornerRadius: 26)
    }
}

struct StepsBar: View {
    var current: Int
    private let steps = ["Choose a lesson", "Watch the guide", "Record", "Replay", "View feedback", "Correct & retry"]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(spacing: 6) {
                        ZStack {
                            Circle().fill(index == current ? Color.mcSage : index < current ? Color.mcSageSoft : .white.opacity(0.7))
                            if index < current {
                                Image(systemName: "checkmark").font(.caption2.bold()).foregroundStyle(Color.mcSage)
                            } else {
                                Text("\(index + 1)").font(.caption2.bold()).foregroundStyle(index == current ? .white : Color.mcInkSoft)
                            }
                        }
                        .frame(width: 22, height: 22)
                        Text(step)
                            .font(.subheadline.weight(index == current ? .bold : .regular))
                            .foregroundStyle(index <= current ? Color.mcInk : Color.mcInkSoft)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityValue(index < current ? "done" : index == current ? "current step" : "")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .glassCard(cornerRadius: 22)
    }
}

struct LessonPicker: View {
    @Environment(AppModel.self) private var model
    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "Lessons")
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(model.lessons) { lesson in
                    let selected = lesson.id == model.lessonId
                    let count = model.attempts[lesson.id]?.count ?? 0
                    Button {
                        model.selectLesson(lesson.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(lesson.text).font(.title3.bold())
                            Text(lesson.target.label).font(.footnote).foregroundStyle(Color.mcInkSoft)
                            if count > 0 {
                                Text("\(count) \(count == 1 ? "attempt" : "attempts") this session")
                                    .font(.caption2.bold())
                                    .foregroundStyle(Color.mcSage)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(selected ? Color.mcSageSoft : .white.opacity(0.45), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(selected ? Color.mcSage : .clear, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .padding(16)
        .glassCard()
    }
}

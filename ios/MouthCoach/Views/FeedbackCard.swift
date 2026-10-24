import SwiftUI

struct FeedbackCard: View {
    @Environment(AppModel.self) private var model

    private static let demoNotice = "Demo feedback. Your recording has not been automatically assessed."
    private static let claudeNotice = "AI feedback from Claude, based on your lip measurements and mouth snapshots. It can be wrong, and it does not hear your audio."

    var body: some View {
        let reason = model.claudeUnavailableReason
        let showClaudeNotice = model.feedback?.source == .claude || (model.feedback == nil && reason == nil && model.currentAttempt != nil)

        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "Feedback")
            Label(showClaudeNotice ? Self.claudeNotice : Self.demoNotice, systemImage: "info.circle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(showClaudeNotice ? Color.mcSky : Color.mcAmberInk)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background((showClaudeNotice ? Color.mcSkySoft : Color.mcAmberSoft).opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

            if let feedback = model.feedback {
                FeedbackDetails(feedback: feedback)
            } else if let source = model.feedbackLoading {
                HStack {
                    ProgressView()
                    Text(source == .claude ? "Claude is looking at your attempt…" : "Preparing demo feedback…").font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            } else if let error = model.feedbackError {
                VStack(alignment: .leading, spacing: 10) {
                    Text(error).font(.headline).foregroundStyle(Color.mcAmberInk)
                    HStack {
                        if reason == nil { Button("Try Claude again") { model.requestFeedback(.claude) }.secondaryButton() }
                        Button("Show demo feedback") { model.requestFeedback(.demo) }.secondaryButton()
                    }
                }
                .padding(14)
                .background(Color.mcAmberSoft.opacity(0.75), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            } else if let attempt = model.currentAttempt {
                VStack(alignment: .leading, spacing: 8) {
                    if reason == nil {
                        Button("Get feedback from Claude", systemImage: "sparkles") { model.requestFeedback(.claude) }.primaryButton()
                        let count = attempt.analysis?.snapshots.count ?? 0
                        Text("Sends your lip measurements\(count > 0 ? " and \(count) mouth-only snapshots" : "") to Anthropic through the MouthCoach server. Audio is not sent.")
                            .font(.caption)
                            .foregroundStyle(Color.mcInkSoft)
                        Button("Show demo feedback instead") { model.requestFeedback(.demo) }
                            .font(.subheadline)
                    } else {
                        Button("Show demo feedback", systemImage: "sparkles") { model.requestFeedback(.demo) }.primaryButton()
                        if let reason { Text(reason).font(.caption).foregroundStyle(Color.mcInkSoft) }
                    }
                }
            } else {
                Text("Record “\(model.lesson.text)” to get feedback.")
                    .foregroundStyle(Color.mcInkSoft)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
        }
        .padding(18)
        .glassCard()
        .animation(.default, value: model.feedback?.attemptId)
    }
}

private struct FeedbackDetails: View {
    @Environment(AppModel.self) private var model
    var feedback: PracticeFeedback

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if feedback.source == .demo {
                Text("\(feedback.scenarioLabel ?? "Example") (scripted)").font(.subheadline.weight(.semibold)).foregroundStyle(Color.mcInkSoft)
            } else {
                Pill(text: feedback.status.label,
                     foreground: feedback.status == .insufficientData ? .mcAmberInk : feedback.status == .suggestion ? .mcSky : .mcSage,
                     background: feedback.status == .insufficientData ? .mcAmberSoft : feedback.status == .suggestion ? .mcSkySoft : .mcSageSoft)
            }

            block(background: .mcSageSoft) {
                Text("Practice focus").font(.subheadline.bold()).foregroundStyle(Color.mcSage)
                Text(feedback.practiceFocus).font(.title3.bold())
            }

            if feedback.source == .claude, let observation = feedback.observation {
                block(background: .white.opacity(0.55)) {
                    HStack(spacing: 8) {
                        Pill(text: "OBSERVED", foreground: .white, background: .mcInk)
                        Text("In your attempt").font(.subheadline.bold())
                    }
                    Text(observation)
                    if let compared = feedback.comparedToPrevious {
                        (Text("Compared with last time: ").bold() + Text(compared)).font(.subheadline)
                    }
                    if let evidence = feedback.evidence, !evidence.isEmpty {
                        Text(evidence.joined(separator: " · ")).font(.caption).foregroundStyle(Color.mcInkSoft)
                    }
                }
            }

            block(background: .mcSkySoft) {
                HStack(spacing: 8) {
                    Pill(text: "SUGGESTION", foreground: .white, background: .mcSky)
                    Text("What to try").font(.subheadline.bold()).foregroundStyle(Color.mcSky)
                }
                Text(feedback.tip)
            }

            HStack {
                if feedback.actionId.behavior != .resetPractice {
                    Button(feedback.actionId.label, systemImage: "play.fill") { model.runAction(feedback.actionId) }.primaryButton()
                }
                Button("Try again", systemImage: "arrow.counterclockwise") { model.resetPractice() }
                    .modifier(TryAgainStyle(prominent: feedback.actionId.behavior == .resetPractice))
            }
            if let modelName = feedback.model {
                Text("Generated by \(modelName).").font(.caption).foregroundStyle(Color.mcInkSoft)
            }
        }
    }

    private func block<Content: View>(background: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(background.opacity(0.75), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct TryAgainStyle: ViewModifier {
    var prominent: Bool
    func body(content: Content) -> some View {
        if prominent { content.primaryButton() } else { content.secondaryButton() }
    }
}

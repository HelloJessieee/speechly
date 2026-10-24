import SwiftUI

private enum AppPage: Int, CaseIterable, Hashable {
    case practice, guide, results

    var title: String {
        switch self {
        case .practice: "Practice"
        case .guide: "Mouth Guide"
        case .results: "Results"
        }
    }

    var symbol: String {
        switch self {
        case .practice: "waveform"
        case .guide: "mouth"
        case .results: "chart.bar.xaxis"
        }
    }
}

struct ContentView: View {
    @Environment(AppModel.self) private var model
    @State private var page: AppPage = .practice
    @State private var showConnectionSettings = false

    var body: some View {
        VStack(spacing: 0) {
            header
            TabView(selection: $page) {
                screen(title: "Practice", subtitle: "Speak freely, then confirm what you meant to say.") {
                    PracticeCard()
                    RecognitionCard()
                }
                .tag(AppPage.practice)

                screen(title: "Mouth Guide", subtitle: "Follow the looping sentence, one word at a time.") {
                    if model.customReference || !model.freeSpeechMode {
                        ReferenceCard()
                        GuideOverlayCard()
                        if !model.customReference { LessonGuideCard() }
                    } else {
                        emptyState(symbol: "mouth", title: "Your guide will appear here",
                                   detail: "Record a sentence on Practice, then confirm the words Whisper heard.") {
                            page = .practice
                        }
                    }
                }
                .tag(AppPage.guide)

                screen(title: "Results", subtitle: "Review the model's guesses and your next practice step.") {
                    AnalysisResultCard()
                    if let analysis = model.currentAttempt?.analysis {
                        MeasurementsView(analysis: analysis)
                    }
                    if !model.freeSpeechMode { FeedbackCard() }
                }
                .tag(AppPage.results)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            bottomNavigation
        }
        .background(BackdropView())
        .foregroundStyle(Color.mcInk)
        .onChange(of: model.customReference) { _, ready in
            if ready { withAnimation { page = .guide } }
        }
        .sheet(isPresented: $showConnectionSettings) { MacConnectionSettings() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "mouth.fill")
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(Color.mcSage, in: RoundedRectangle(cornerRadius: 12))
                .accessibilityHidden(true)
            Text("Speech Mirror").font(.headline.bold())
            Spacer()
            Menu {
                Button("Free speech", systemImage: "waveform") {
                    model.startFreeSpeech()
                    page = .practice
                }
                Divider()
                ForEach(model.lessons) { lesson in
                    Button(lesson.text) {
                        model.selectLesson(lesson.id)
                        page = .guide
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Text(model.freeSpeechMode ? "Free speech" : model.lesson.text)
                    Image(systemName: "chevron.down").font(.caption.bold())
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.mcSage)
            }
            .accessibilityLabel("Choose free speech or a lesson")
            Button { showConnectionSettings = true } label: {
                Image(systemName: "gearshape")
                    .font(.title3)
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Mac connection settings")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private func screen<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.largeTitle.bold())
                    Text(subtitle).font(.subheadline).foregroundStyle(Color.mcInkSoft)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                content()
                Text("Reference mouth shapes and model predictions are practice aids, not proof of correct pronunciation.")
                    .font(.caption).foregroundStyle(Color.mcInkSoft)
                    .padding(.bottom, 10)
            }
            .padding(16)
            .frame(maxWidth: 700)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func emptyState(symbol: String, title: String, detail: String, action: @escaping () -> Void) -> some View {
        VStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 42)).foregroundStyle(Color.mcSage)
            Text(title).font(.title3.bold())
            Text(detail).font(.subheadline).multilineTextAlignment(.center).foregroundStyle(Color.mcInkSoft)
            Button("Go to Practice", action: action).primaryButton()
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .glassCard()
    }

    private var bottomNavigation: some View {
        HStack(spacing: 4) {
            ForEach(AppPage.allCases, id: \.self) { destination in
                Button {
                    withAnimation { page = destination }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: destination.symbol).font(.system(size: 20, weight: .semibold))
                        Text(destination.title).font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(page == destination ? Color.mcSage : Color.mcInkSoft)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(page == destination ? Color.mcSageSoft : .clear,
                                in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(page == destination ? .isSelected : [])
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .background(.ultraThinMaterial)
    }
}

private struct MacConnectionSettings: View {
    @Environment(\.dismiss) private var dismiss
    @State private var address = SpeechMirrorService.baseURL.absoluteString
    @State private var error: String?
    @State private var connectionStatus: String?
    @State private var checking = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Mac speech service").font(.title2.bold())
                Text("Your iPhone sends recordings to this Mac for Whisper, phoneme analysis, and Gemma suggestions.")
                    .font(.subheadline).foregroundStyle(.secondary)
                TextField("http://Mac-IP:8765", text: $address)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                Button("Save address") {
                    guard let url = URL(string: address), url.scheme == "http" || url.scheme == "https",
                          url.host != nil, url.port == 8765 else {
                        error = "Enter a full Mac address using port 8765."
                        return
                    }
                    SpeechMirrorService.baseURL = url
                    error = nil
                    dismiss()
                }
                .primaryButton()
                Button("Test saved connection") {
                    checking = true
                    connectionStatus = nil
                    Task {
                        do {
                            _ = try await SpeechMirrorService.shared.reference(for: "see me")
                            connectionStatus = "Mac service is reachable."
                        } catch {
                            connectionStatus = "Could not reach the Mac service. Check the address and Wi-Fi."
                        }
                        checking = false
                    }
                }
                .secondaryButton()
                if checking { ProgressView("Checking…") }
                if let error { Text(error).foregroundStyle(Color.mcAmberInk) }
                if let connectionStatus { Text(connectionStatus).foregroundStyle(Color.mcInkSoft) }
                Spacer()
            }
            .padding(20)
            .navigationTitle("Connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

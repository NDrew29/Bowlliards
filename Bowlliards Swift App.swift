import SwiftUI
import PlaygroundSupport

struct ContentView: View {
    @State private var currentFrame = 1
    @State private var currentBall = 1
    @State private var frameClock = 0
    @State private var gameClock = 0
    @State private var totalTime = 0
    @State private var gameType = 5
    @State private var scores = [[Int]](repeating: [0, 0], count: 10)
    @State private var frameScores = [Int](repeating: 0, count: 10)
    @State private var undoStack: [(Int, Int, [[Int]], [Int])] = []
    @State private var timer: Timer?
    @State private var pausedTime = 0
    @State private var isPaused = false
    @State private var showEndGameAlert = false
    @State private var showSetupScreen = true

    var body: some View {
        VStack {
            if showSetupScreen {
                setupView
            } else {
                gameView
            }
        }
        .padding()
        .onAppear(perform: startGame)
        .alert(isPresented: $showEndGameAlert) {
            Alert(
                title: Text("Game Over"),
                message: Text("Total Score: \(frameScores.reduce(0, +))"),
                dismissButton: .default(Text("OK"), action: { self.showSetupScreen = true })
            )
        }
    }

    var setupView: some View {
        VStack {
            Text("Bowlliards Tracker")
                .font(.largeTitle)
                .padding()

            Picker("Game Type", selection: $gameType) {
                Text("5 Frames").tag(5)
                Text("10 Frames").tag(10)
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()

            Button(action: {
                self.startGame()
                self.showSetupScreen = false
            }) {
                Text("Start Game")
                    .font(.title)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
        }
    }

    var gameView: some View {
        VStack {
            Text("Bowlliards Tracker")
                .font(.largeTitle)
                .padding()

            HStack {
                VStack(alignment: .leading) {
                    Text("Game Clock: \(formatTime(seconds: gameClock))")
                    Text("Frame Clock: \(formatTime(seconds: frameClock))")
                }
                Spacer()
                VStack {
                    Text("Current Frame: \(currentFrame)")
                        .font(.title)
                    Text("Ball: \(currentBall)")
                        .font(.title)
                }
            }
            .padding()

            HStack {
                Button(action: addScore) {
                    Text("+1 Point")
                }
                .padding()

                Button(action: recordStrike) {
                    Text("Strike (X)")
                }
                .padding()

                Button(action: recordSpare) {
                    Text("Spare (/)")
                }
                .padding()

                Button(action: nextBall) {
                    Text("Next Ball")
                }
                .padding()

                Button(action: undoScore) {
                    Text("Undo")
                }
                .padding()

                Button(action: pauseGame) {
                    Text(isPaused ? "Resume" : "Pause")
                }
                .padding()

                Button(action: { self.showSetupScreen = true }) {
                    Text("End Game")
                }
                .padding()
            }

            HStack {
                Text("Frame")
                    .bold()
                Spacer()
                Text("1st Ball")
                    .bold()
                Spacer()
                Text("2nd Ball")
                    .bold()
                Spacer()
                Text("Frame/Total Score")
                    .bold()
            }
            .padding(.horizontal)

            List {
                ForEach(0..<gameType, id: \.self) { frame in
                    HStack {
                        Text("Frame \(frame + 1)")
                            .bold()
                        Spacer()
                        Text(formatScore(scores[frame][0]))
                            .bold()
                        Spacer()
                        Text(formatScore(scores[frame][1]))
                            .bold()
                        Spacer()
                        Text("\(frameScores[frame])")
                            .bold()
                        Spacer()
                        Text("\(frameScores.prefix(frame + 1).reduce(0, +))")
                            .bold()
                    }
                }
            }

            Spacer()
        }
    }

    func startGame() {
        currentFrame = 1
        currentBall = 1
        frameClock = 0
        gameClock = 0
        totalTime = 0
        scores = [[Int]](repeating: [0, 0], count: gameType)
        frameScores = [Int](repeating: 0, count: gameType)
        undoStack = []
        startClocks()
    }

    func startClocks() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if !isPaused {
                frameClock += 1
                gameClock += 1
                totalTime += 1
            }
        }
    }

    func formatTime(seconds: Int) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        return String(format: "%02d:%02d", minutes, remainingSeconds)
    }

    func addScore() {
        undoStack.append((currentFrame, currentBall, scores, frameScores))

        if currentBall == 1 {
            if scores[currentFrame - 1][0] < 10 {
                scores[currentFrame - 1][0] += 1
            }
        } else {
            if scores[currentFrame - 1][0] + scores[currentFrame - 1][1] < 10 {
                scores[currentFrame - 1][1] += 1
            }
        }
        calculateFrameScores()
    }

    func recordStrike() {
        undoStack.append((currentFrame, currentBall, scores, frameScores))
        scores[currentFrame - 1][0] = 10
        scores[currentFrame - 1][1] = 0
        frameScores[currentFrame - 1] = 10
        nextFrame()
    }

    func recordSpare() {
        undoStack.append((currentFrame, currentBall, scores, frameScores))
        if currentBall == 1 {
            scores[currentFrame - 1][0] = 10
            scores[currentFrame - 1][1] = 0
        } else {
            scores[currentFrame - 1][1] = 10 - scores[currentFrame - 1][0]
        }
        frameScores[currentFrame - 1] = 10
        nextFrame()
    }

    func nextBall() {
        if currentBall == 1 {
            if scores[currentFrame - 1][0] == 10 {
                scores[currentFrame - 1][1] = 0
                frameScores[currentFrame - 1] = 10
                nextFrame()
            } else {
                currentBall = 2
            }
        } else {
            if scores[currentFrame - 1][0] + scores[currentFrame - 1][1] == 10 {
                frameScores[currentFrame - 1] = 10
            } else {
                frameScores[currentFrame - 1] = scores[currentFrame - 1][0] + scores[currentFrame - 1][1]
            }
            calculateFrameScores()
            nextFrame()
        }
    }

    func nextFrame() {
        if currentFrame == gameType {
            endGame()
        } else {
            currentFrame += 1
            currentBall = 1
            frameClock = 0
        }
    }

    func calculateFrameScores() {
        for i in 0..<gameType {
            if scores[i][0] == 10 {
                frameScores[i] = 10 + (scores[i + 1][0] + scores[i + 1][1])
            } else if scores[i][0] + scores[i][1] == 10 {
                frameScores[i] = 10 + scores[i + 1][0]
            } else {
                frameScores[i] = scores[i][0] + scores[i][1]
            }
        }
    }

    func endGame() {
        timer?.invalidate()
        _ = frameScores.reduce(0, +)
        showEndGameAlert = true
    }

    func pauseGame() {
        isPaused.toggle()
    }

    func undoScore() {
        if let (lastFrame, lastBall, lastScores, lastFrameScores) = undoStack.popLast() {
            currentFrame = lastFrame
            currentBall = lastBall
            scores = lastScores
            frameScores = lastFrameScores
            calculateFrameScores()
        }
    }

    func formatScore(_ score: Int) -> String {
        if score == 10 {
            return "X"
        } else if currentBall == 2 && score + scores[currentFrame - 1][0] == 10 {
            return "/"
        } else {
            return "\(score)"
        }
    }
}

struct Bowlliards: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

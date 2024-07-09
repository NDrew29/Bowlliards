import SwiftUI

struct ContentView: View {
    @State private var player1Name: String = ""
    @State private var player2Name: String = ""
    @State private var currentServer: String = ""
    @State private var player1Score: Int = 0
    @State private var player2Score: Int = 0
    @State private var gameClock = 0
    @State private var matchClock = 0
    @State private var timer: Timer?
    @State private var coinFlipResult: String = ""
    @State private var isFlipping: Bool = false
    @State private var showSetupScreen: Bool = true
    @State private var showCoinFlipScreen: Bool = false
    @State private var coinImage: String = "circle"
    @State private var flipImages: [String] = ["circle", "circle.fill"]
    @State private var scoreHistory: [(Int, Int, String)] = []
    @State private var raceToGames: Int = 3
    @State private var player1Games: Int = 0
    @State private var player2Games: Int = 0
    @State private var currentGame: Int = 1
    @State private var serveCounter: Int = 0

    var body: some View {
        VStack {
            if showSetupScreen {
                setupView
            } else if showCoinFlipScreen {
                coinFlipView
            } else {
                gameView
            }
        }
        .padding()
        .onAppear(perform: startMatch)
    }

    var setupView: some View {
        VStack {
            Text("Table Tennis Game & Score Keeper")
                .font(.largeTitle)
                .padding()

            Picker("Race to Games", selection: $raceToGames) {
                Text("3 Games").tag(3)
                Text("5 Games").tag(5)
                Text("7 Games").tag(7)
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()

            Button(action: {
                self.showSetupScreen = false
                self.showCoinFlipScreen = true
            }) {
                Text("Proceed to Coin Flip")
                    .font(.title)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
            .padding()
        }
    }

    var coinFlipView: some View {
        VStack {
            Text("CALL IT IN THE AIR!")
                .font(.largeTitle)
                .padding()

            Button(action: {
                startCoinFlip()
            }) {
                Text("Flip Coin")
                    .font(.title)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
            .disabled(isFlipping)
            .padding()

            if isFlipping {
                Image(systemName: coinImage)
                    .resizable()
                    .frame(width: 100, height: 100)
                    .padding()
                    .onAppear {
                        self.startCoinImageFlip()
                    }
            }

            if !coinFlipResult.isEmpty {
                Text("Coin Flip Result: \(coinFlipResult)")
                    .font(.title)
                    .padding()
                
                TextField("Enter Player 1 Name", text: $player1Name)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding()
                
                TextField("Enter Player 2 Name", text: $player2Name)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding()
                
                Button(action: {
                    currentServer = coinFlipResult == "Heads" ? player1Name : player2Name
                    showCoinFlipScreen = false
                    startGame()
                }) {
                    Text("Start Match")
                        .font(.title)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .padding()
            }
        }
    }

    var gameView: some View {
        VStack {
            Text("Table Tennis Game")
                .font(.largeTitle)
                .padding()
            
            Text("Match Clock: \(formatTime(seconds: matchClock))")
                .font(.title2)
                .padding()
            
            Text("Game Clock: \(formatTime(seconds: gameClock))")
                .font(.title2)
                .padding()
            
            Text("Current Server: \(currentServer)")
                .font(.title2)
                .padding()

            Text("Current Match Score: \(player1Games) - \(player2Games)")
                .font(.title3)
                .padding()

            HStack {
                VStack {
                    Text(player1Name)
                        .font(.title)
                        .bold()
                    Text("\(player1Score)")
                        .font(.largeTitle)
                        .padding()
                    
                    Button(action: {
                        incrementScore(for: &player1Score)
                    }) {
                        Text("+1 Point")
                            .font(.title)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .padding()
                }

                VStack {
                    Text(player2Name)
                        .font(.title)
                        .bold()
                    Text("\(player2Score)")
                        .font(.largeTitle)
                        .padding()
                    
                    Button(action: {
                        incrementScore(for: &player2Score)
                    }) {
                        Text("+1 Point")
                            .font(.title)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .padding()
                }
            }

            HStack {
                Button(action: undoLastAction) {
                    Text("Undo")
                        .font(.title)
                        .padding()
                        .background(Color.orange)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .padding()

                Button(action: endGameEarly) {
                    Text("End Game")
                        .font(.title)
                        .padding()
                        .background(Color.red)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .padding()
            }
        }
    }

    func startMatch() {
        matchClock = 0
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            matchClock += 1
        }
    }

    func startGame() {
        gameClock = 0
        player1Score = 0
        player2Score = 0
        serveCounter = 0
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            gameClock += 1
            matchClock += 1
        }
    }

    func startCoinFlip() {
        isFlipping = true
        coinFlipResult = ""
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            self.isFlipping = false
            self.coinFlipResult = Bool.random() ? "Heads" : "Tails"
        }
    }

    func startCoinImageFlip() {
        var flipCount = 0
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            if flipCount >= 40 {
                timer.invalidate()
            } else {
                flipCount += 1
                self.coinImage = self.flipImages[flipCount % self.flipImages.count]
            }
        }
    }

    func formatTime(seconds: Int) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        return String(format: "%02d:%02d", minutes, remainingSeconds)
    }

    func incrementScore(for playerScore: inout Int) {
        scoreHistory.append((player1Score, player2Score, currentServer))
        playerScore += 1
        serveCounter += 1
        if serveCounter % 2 == 0 {
            switchServer()
        }
        checkForGameWin()
    }

    func switchServer() {
        currentServer = (currentServer == player1Name) ? player2Name : player1Name
    }

    func checkForGameWin() {
        if (player1Score >= 11 || player2Score >= 11) && abs(player1Score - player2Score) >= 2 {
            if player1Score > player2Score {
                player1Games += 1
                endGame(winner: player1Name)
            } else {
                player2Games += 1
                endGame(winner: player2Name)
            }
        }
    }

    func endGame(winner: String) {
        timer?.invalidate()
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            let alert = UIAlertController(title: "Game Over", message: "\(winner) wins this game!", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                if self.player1Games == self.raceToGames || self.player2Games == self.raceToGames {
                    self.endMatch(winner: winner)
                } else {
                    self.startGame()
                }
            })
            window.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    func endMatch(winner: String) {
        timer?.invalidate()
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            let alert = UIAlertController(title: "Match Over", message: "\(winner) wins the match!", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                self.showSetupScreen = true
                self.resetMatch()
            })
            window.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    func endGameEarly() {
        timer?.invalidate()
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            let alert = UIAlertController(title: "Game Ended", message: "Game ended early.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                self.showSetupScreen = true
                self.resetMatch()
            })
            window.rootViewController?.present(alert, animated: true, completion: nil)
        }
    }

    func undoLastAction() {
        if let lastState = scoreHistory.popLast() {
            player1Score = lastState.0
            player2Score = lastState.1
            currentServer = lastState.2
            serveCounter = (player1Score + player2Score) % 4
        }
    }

    func resetMatch() {
        player1Score = 0
        player2Score = 0
        player1Games = 0
        player2Games = 0
        gameClock = 0
        matchClock = 0
        coinFlipResult = ""
        currentServer = ""
        scoreHistory = []
        startMatch()
    }
}

struct TableTennisGameApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

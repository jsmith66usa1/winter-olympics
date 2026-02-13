
export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface SportImage {
  sport: string;
  imageUrl: string;
  hint: string;
}

export interface HistoryItem {
  sport: string;
  imageUrl: string;
  playerName: string;
  playerGuess: string;
  isCorrect: boolean;
}

export enum GameState {
  LOBBY = 'LOBBY',
  ROUND_START = 'ROUND_START',
  PLAYING = 'PLAYING',
  VERIFYING = 'VERIFYING',
  ROUND_RESULTS = 'ROUND_RESULTS',
  GAME_OVER = 'GAME_OVER',
  ERROR = 'ERROR'
}

export interface GameContext {
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  maxRounds: number;
  currentImage: SportImage | null;
  state: GameState;
  history: HistoryItem[];
}

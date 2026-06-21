export interface Match {
  id: number;
  player1: number;
  player2: number;
  player1_username?: string;
  player2_username?: string;
  winner: number | null;
  score?: string;
  player1_games_won?: number;
  player2_games_won?: number;
  match_format: 'BEST_OF_3' | 'BEST_OF_5' | 'BEST_OF_7' | 'RACE_TO_5' | 'RACE_TO_11' | 'RACE_TO_21';
  target_score: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  table_number?: number;
  games?: Game[];
  created_at: string;
  completed_at: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  season?: number;
  is_rated?: boolean;
}

export interface Game {
  id: number;
  match: number;
  game_number: number;
  player1_score: number;
  player2_score: number;
  winner: number | null;
  is_completed?: boolean;
  started_at?: string;
  completed_at: string | null;
}

export interface MatchEvent {
  id: number;
  match: number;
  game: number;
  event_type: 'POINT' | 'GAME_START' | 'GAME_END' | 'MATCH_START' | 'MATCH_END';
  player: number;
  timestamp: string;
  score_after: string;
}

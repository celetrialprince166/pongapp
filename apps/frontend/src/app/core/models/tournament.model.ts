export interface Tournament {
  id: number;
  name: string;
  description: string;
  tournament_format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'GROUP_KNOCKOUT';
  format?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS' | 'GROUP_KNOCKOUT';  // Alias for backward compatibility
  league?: 'AMATEUR' | 'PRO';
  status: 'UPCOMING' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  start_date: string;
  end_date?: string;
  registration_deadline: string;
  min_participants: number;
  max_participants: number;
  participant_count: number;  // Backend field name
  current_participants?: number;  // Alias for backward compatibility
  location?: string;
  is_rated: boolean;
  is_full?: boolean;
  is_registration_open?: boolean;
  is_registered?: boolean;
  organizer?: number;
  organizer_username?: string;
  season?: number | null;
  match_format?: 'BEST_OF_3' | 'BEST_OF_5' | 'BEST_OF_7';
  prize_label?: string;
  awards_distributed?: boolean;
  created_at: string;
  updated_at?: string;
  winner?: number;
  winner_name?: string;
}

export interface TournamentParticipant {
  id: number;
  tournament: number;
  player: number;
  player_username?: string;
  player_avatar?: string;
  player_rating?: number;
  seed: number | null;
  final_rank: number | null;
  status: 'PENDING' | 'CONFIRMED' | 'WITHDRAWN' | 'ELIMINATED';
  registered_at: string;
  confirmed_at?: string;
  tournament_points?: number;
  // Optional fields for future backend support
  elo_rating?: number;
  elo_trend?: number;
  club?: string;
}

export interface TournamentMatch {
  id: number;
  tournament: number;
  match: number;
  round: number;
  match_number: number;
  player1: number | null;
  player2: number | null;
  winner: number | null;
  is_bye: boolean;
  created_at: string;
  completed_at: string | null;
  // Optional enriched fields from backend
  player1_name?: string;
  player2_name?: string;
  player1_score?: number;
  player2_score?: number;
  // Optional fields for future backend support
  player1_seed?: number;
  player2_seed?: number;
  scheduled_time?: string;
  table_number?: number;
  status?: 'pending' | 'live' | 'completed';
  winner_advances_to?: number | null;
}

export interface GroupStanding {
  id: number;
  player: number;
  player_username: string;
  matches_played: number;
  wins: number;
  losses: number;
  games_won: number;
  games_lost: number;
  points: number;
  goal_difference: number;
  advances: boolean;
}

export interface GroupData {
  group: { id: number; name: string };
  standings: GroupStanding[];
}

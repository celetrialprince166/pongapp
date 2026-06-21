export interface Player {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  current_rating: number;
  highest_rating?: number;
  league: 'AMATEUR' | 'PRO';
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  loss_rate?: number;
  win_streak: number;
  longest_win_streak?: number;
  avatar: string | null;
  is_active_player?: boolean;
  date_joined?: string;
  achievements?: any[];
  achievements_count?: number;
  role?: string;
  rank?: number;
}

export interface LeaderboardEntry extends Player {
  rank?: number;
}

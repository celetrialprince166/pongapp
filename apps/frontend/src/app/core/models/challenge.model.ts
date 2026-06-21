export interface Challenge {
  id: number;
  challenger: number;
  challenger_username?: string;
  challenged: number;
  challenged_username?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED';
  match_format: 'BEST_OF' | 'RACE_TO';
  format_value: number;
  match_type?: 'DUEL' | 'TRAINING';
  message?: string;
  created_at: string;
  expires_at: string;
  is_forced: boolean;
  match?: number;
  season?: number;
}

export interface ChallengeRequest {
  challenged: number;
  match_format: 'BEST_OF' | 'RACE_TO';
  format_value: number;
  match_type?: 'DUEL' | 'TRAINING';
  message?: string;
  season?: number;
}

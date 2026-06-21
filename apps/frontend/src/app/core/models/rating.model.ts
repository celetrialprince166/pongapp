export interface RatingHistory {
  id: number;
  user: number;
  rating: number;
  change: number;
  timestamp: string;
  match: number | null;
  reason: string;
  league: 'AMATEUR' | 'PRO';
  season: number | null;
}

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Rating {
  id: number;
  user: number;
  current_rating: number;
  league: 'AMATEUR' | 'PRO';
  season: number;
  created_at: string;
  updated_at: string;
}

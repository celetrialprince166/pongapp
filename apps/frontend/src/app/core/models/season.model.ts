export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  ended_at?: string | null;
}

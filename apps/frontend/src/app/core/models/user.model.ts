export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    bio: string;
    avatar: string | null;
    current_rating: number;
    highest_rating: number;
    league: string;
    total_matches: number;
    wins: number;
    losses: number;
    win_rate: number;
    loss_rate: number;
    win_streak: number;
    longest_win_streak: number;
    is_active_player: boolean;
    last_match_date: string | null;
    date_joined: string;
    achievements: any[];
    achievements_count: number;
    role?: string; // Added role field as per requirements
    is_staff?: boolean; // Django staff status
}

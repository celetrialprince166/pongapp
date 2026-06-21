import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Signup } from './features/auth/signup/signup';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';
import { ChallengeHub } from './features/challenge-hub/challenge-hub';
import { AdminDashboard } from './features/admin-dashboard/admin-dashboard.component';
import { LeagueStandings } from './features/league-standings/league-standings';

// User tournament screens
import { TournamentListPage } from './features/tournaments/tournament-list-page/tournament-list-page';
import { TournamentDetailPage } from './features/tournaments/tournament-detail-page/tournament-detail-page';

// Admin screens
import { SeasonManagementComponent } from './features/admin/season-management/season-management.component';
import { TournamentOverviewComponent } from './features/admin/tournament-overview/tournament-overview.component';
import { TournamentCreationComponent } from './features/admin/tournament-creation/tournament-creation.component';
import { TournamentCreationWizardComponent } from './features/admin/tournament-creation-wizard/tournament-creation-wizard.component';
import { TournamentEditComponent } from './features/admin/tournament-edit/tournament-edit';
import { TournamentDetailAdminComponent } from './features/admin/tournament-detail-admin/tournament-detail-admin.component';
import { PlayerManagementComponent } from './features/admin/player-management/player-management.component';
import { UserManagementComponent } from './features/admin/user-management/user-management.component';
import { PointAllocationComponent } from './features/admin/point-allocation/point-allocation.component';
import { SeasonDetailComponent } from './features/admin/season-detail/season-detail.component';

import { AppLayout } from './layout/app-layout/app-layout';
import { LiveScoringComponent } from './features/matches/live-scoring/live-scoring.component';
import { AdminMatchScoringComponent } from './features/matches/admin-match-scoring/admin-match-scoring.component';

// Guards
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
    // Public routes
    { path: 'login', component: Login },
    { path: 'signup', component: Signup },

    // Protected routes (require authentication)
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            // Match live scoring
            { path: 'matches/:id/live', component: LiveScoringComponent, canActivate: [adminGuard] },
            { path: 'admin/matches/:id/score', component: AdminMatchScoringComponent, canActivate: [adminGuard] },

            // Player routes (require authentication)
            { path: 'dashboard', component: DashboardPage },
            { path: 'league-standings', component: LeagueStandings },
            { path: 'challenge-hub', component: ChallengeHub },
            { path: 'tournaments', component: TournamentListPage },
            { path: 'tournaments/:id', component: TournamentDetailPage },

            // Admin routes (require authentication + admin role)
            {
                path: 'admin-dashboard',
                component: AdminDashboard,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/dashboard',
                component: AdminDashboard,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/season-management',
                component: SeasonManagementComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/season-management/:id',
                component: SeasonDetailComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/tournament-overview',
                component: TournamentOverviewComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/tournament-creation',
                component: TournamentCreationComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/tournaments/create',
                component: TournamentCreationWizardComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/tournaments/:id/edit',
                component: TournamentEditComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/tournaments/:id',
                component: TournamentDetailAdminComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/player-management',
                component: PlayerManagementComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/user-management',
                component: UserManagementComponent,
                canActivate: [adminGuard]
            },
            {
                path: 'admin/point-allocation',
                component: PointAllocationComponent,
                canActivate: [adminGuard]
            },
        ]
    },

    // Default redirect
    { path: '', redirectTo: '/login', pathMatch: 'full' },

    // Wildcard route for 404 - redirect to login
    { path: '**', redirectTo: '/login' }
];

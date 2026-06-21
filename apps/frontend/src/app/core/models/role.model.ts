/**
 * User Role Enum
 * Defines the different user roles in the system
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  PLAYER = 'PLAYER',
  MODERATOR = 'MODERATOR'
}

/**
 * Permission Enum
 * Defines granular permissions that can be assigned to roles
 */
export enum Permission {
  // User Management
  VIEW_USERS = 'VIEW_USERS',
  CREATE_USERS = 'CREATE_USERS',
  EDIT_USERS = 'EDIT_USERS',
  DELETE_USERS = 'DELETE_USERS',
  MANAGE_USER_ROLES = 'MANAGE_USER_ROLES',

  // Season Management
  VIEW_SEASONS = 'VIEW_SEASONS',
  CREATE_SEASONS = 'CREATE_SEASONS',
  EDIT_SEASONS = 'EDIT_SEASONS',
  DELETE_SEASONS = 'DELETE_SEASONS',
  MANAGE_SEASON_LIFECYCLE = 'MANAGE_SEASON_LIFECYCLE',

  // Tournament Management
  VIEW_TOURNAMENTS = 'VIEW_TOURNAMENTS',
  CREATE_TOURNAMENTS = 'CREATE_TOURNAMENTS',
  EDIT_TOURNAMENTS = 'EDIT_TOURNAMENTS',
  DELETE_TOURNAMENTS = 'DELETE_TOURNAMENTS',
  MANAGE_TOURNAMENT_LIFECYCLE = 'MANAGE_TOURNAMENT_LIFECYCLE',

  // Match Management
  VIEW_ALL_MATCHES = 'VIEW_ALL_MATCHES',
  APPROVE_MATCH_RESULTS = 'APPROVE_MATCH_RESULTS',
  EDIT_MATCH_RESULTS = 'EDIT_MATCH_RESULTS',
  DELETE_MATCHES = 'DELETE_MATCHES',

  // Challenge Management
  VIEW_ALL_CHALLENGES = 'VIEW_ALL_CHALLENGES',
  FORCE_CANCEL_CHALLENGES = 'FORCE_CANCEL_CHALLENGES',

  // Admin Dashboard
  VIEW_ADMIN_DASHBOARD = 'VIEW_ADMIN_DASHBOARD',
  VIEW_ADMIN_STATS = 'VIEW_ADMIN_STATS',

  // System Settings
  MANAGE_SYSTEM_SETTINGS = 'MANAGE_SYSTEM_SETTINGS'
}

/**
 * Role Permissions Mapping
 * Maps each role to its allowed permissions
 */
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Full access to all permissions
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.MANAGE_USER_ROLES,
    Permission.VIEW_SEASONS,
    Permission.CREATE_SEASONS,
    Permission.EDIT_SEASONS,
    Permission.DELETE_SEASONS,
    Permission.MANAGE_SEASON_LIFECYCLE,
    Permission.VIEW_TOURNAMENTS,
    Permission.CREATE_TOURNAMENTS,
    Permission.EDIT_TOURNAMENTS,
    Permission.DELETE_TOURNAMENTS,
    Permission.MANAGE_TOURNAMENT_LIFECYCLE,
    Permission.VIEW_ALL_MATCHES,
    Permission.APPROVE_MATCH_RESULTS,
    Permission.EDIT_MATCH_RESULTS,
    Permission.DELETE_MATCHES,
    Permission.VIEW_ALL_CHALLENGES,
    Permission.FORCE_CANCEL_CHALLENGES,
    Permission.VIEW_ADMIN_DASHBOARD,
    Permission.VIEW_ADMIN_STATS,
    Permission.MANAGE_SYSTEM_SETTINGS
  ],

  [UserRole.MODERATOR]: [
    // Limited admin access
    Permission.VIEW_USERS,
    Permission.VIEW_SEASONS,
    Permission.VIEW_TOURNAMENTS,
    Permission.VIEW_ALL_MATCHES,
    Permission.APPROVE_MATCH_RESULTS,
    Permission.VIEW_ALL_CHALLENGES,
    Permission.VIEW_ADMIN_DASHBOARD,
    Permission.VIEW_ADMIN_STATS
  ],

  [UserRole.PLAYER]: [
    // No admin permissions - players only access their own data
  ]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) || false;
}

/**
 * Check if a role has admin access
 */
export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.MODERATOR;
}

/**
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return RolePermissions[role] || [];
}

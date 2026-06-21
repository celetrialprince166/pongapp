from rest_framework import permissions

class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to users with the ADMIN role.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')


class IsRefereeRole(permissions.BasePermission):
    """
    Allows access to users with REFEREE or ADMIN role.
    (Admins are implicitly Referees)
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        return request.user.role in ['REFEREE', 'ADMIN']

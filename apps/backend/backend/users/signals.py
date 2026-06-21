from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, PlayerProfile, SuperAdmin

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, raw=False, **kwargs):
    if raw or not created:
        return
    # Always create PlayerProfile for players and referees
    if instance.role in ['PLAYER', 'REFEREE']:
        PlayerProfile.objects.create(user=instance)

    # Create SuperAdmin profile for admins
    elif instance.role == 'ADMIN':
        SuperAdmin.objects.create(user=instance)
        # Admins might also need a PlayerProfile if they want to play?
        # Design doc said "No (Not a player)" for "Play Matches" for SuperAdmin.
        # But "View Matches" is "ALL Matches".
        # So we stick to SuperAdmin only for ADMIN role.

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, raw=False, **kwargs):
    if raw:
        return
    if instance.role in ['PLAYER', 'REFEREE'] and hasattr(instance, 'player_profile'):
        instance.player_profile.save()
    elif instance.role == 'ADMIN' and hasattr(instance, 'admin_profile'):
        instance.admin_profile.save()

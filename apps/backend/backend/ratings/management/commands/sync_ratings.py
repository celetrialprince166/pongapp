from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ratings.models import LeagueStanding

User = get_user_model()


class Command(BaseCommand):
    help = 'Sync PlayerProfile.current_rating with the latest LeagueStanding.rating for each user'

    def handle(self, *args, **kwargs):
        synced = 0
        for user in User.objects.select_related('player_profile').all():
            if not hasattr(user, 'player_profile'):
                continue

            best_standing = LeagueStanding.objects.filter(
                user=user
            ).order_by('-rating').first()

            if best_standing:
                profile = user.player_profile
                old = profile.current_rating
                profile.current_rating = best_standing.rating
                profile.save(update_fields=['current_rating'])
                synced += 1
                self.stdout.write(
                    f'{user.username}: {old} → {best_standing.rating}'
                )

        self.stdout.write(self.style.SUCCESS(f'Synced {synced} player ratings.'))

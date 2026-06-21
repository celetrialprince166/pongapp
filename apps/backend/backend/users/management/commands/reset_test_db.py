from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ratings.models import Season
from tournaments.models import Tournament, TournamentParticipant
from matches.models import Match, Game, MatchEvent

User = get_user_model()


class Command(BaseCommand):
    help = 'Reset database to clean test state (DEV ONLY)'

    def handle(self, *args, **options):
        # Delete in dependency order
        MatchEvent.objects.all().delete()
        Game.objects.all().delete()
        Match.objects.all().delete()
        TournamentParticipant.objects.all().delete()
        Tournament.objects.all().delete()
        Season.objects.all().delete()

        # Delete non-superuser accounts only
        User.objects.filter(is_superuser=False).delete()

        # Create admin test user
        admin = User.objects.create_user(
            username='testadmin',
            email='testadmin@pingmaster.com',
            password='AdminPass123!',
            is_staff=True,
        )
        admin.role = 'ADMIN'
        admin.save()

        # Create 8 player test users
        for i in range(1, 9):
            player = User.objects.create_user(
                username=f'testplayer{i}',
                email=f'testplayer{i}@pingmaster.com',
                password='testpass123',
            )
            player.role = 'PLAYER'
            player.save()

        self.stdout.write(
            self.style.SUCCESS(
                'Test database reset complete — 1 admin + 8 players created.'
            )
        )

from django.core.management.base import BaseCommand
from tournaments.models import TournamentParticipant


class Command(BaseCommand):
    help = 'Fix any TournamentParticipant records with invalid status values'

    def handle(self, *args, **kwargs):
        valid_statuses = {'PENDING', 'CONFIRMED', 'WITHDRAWN', 'ELIMINATED'}

        # Fix PENDING_PAY -> CONFIRMED (legacy status)
        updated = TournamentParticipant.objects.filter(
            status='PENDING_PAY'
        ).update(status='CONFIRMED')
        if updated:
            self.stdout.write(self.style.SUCCESS(
                f'Updated {updated} PENDING_PAY records to CONFIRMED'
            ))

        # Fix any other invalid statuses -> PENDING
        invalid = TournamentParticipant.objects.exclude(status__in=valid_statuses)
        count = invalid.count()
        if count:
            invalid.update(status='PENDING')
            self.stdout.write(self.style.WARNING(
                f'Reset {count} invalid-status records to PENDING'
            ))

        if not updated and not count:
            self.stdout.write('No invalid participant statuses found.')

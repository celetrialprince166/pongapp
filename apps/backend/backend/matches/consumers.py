import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class MatchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.group_name = f'match_{self.match_id}'

        # Reject unauthenticated connections
        if self.scope['user'] is None or isinstance(self.scope['user'], AnonymousUser):
            await self.close(code=4001)
            return

        # Join the match group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current match state immediately on connect
        match_data = await self.get_match_data()
        if match_data:
            await self.send(text_data=json.dumps({
                'type': 'match_update',
                'match': match_data,
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Clients don't send data — this is a receive-only channel
        pass

    async def match_update(self, event):
        """Handler for match_update group messages — forwards to WebSocket client."""
        await self.send(text_data=json.dumps({
            'type': 'match_update',
            'match': event['match'],
        }))

    @database_sync_to_async
    def get_match_data(self):
        from matches.models import Match
        from matches.serializers import MatchListSerializer
        try:
            match = Match.objects.select_related(
                'player1', 'player2', 'winner'
            ).get(id=self.match_id)
            return MatchListSerializer(match).data
        except Match.DoesNotExist:
            return None

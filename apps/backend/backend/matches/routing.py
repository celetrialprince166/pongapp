from django.urls import re_path
from matches import consumers

websocket_urlpatterns = [
    re_path(r'ws/matches/(?P<match_id>\d+)/$', consumers.MatchConsumer.as_asgi()),
]

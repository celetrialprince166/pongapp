"""
ASGI config for table_tennis_app project.
Supports both HTTP (Django) and WebSocket (Channels) protocols.
"""

import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'table_tennis_app.settings')
django.setup()

from matches.routing import websocket_urlpatterns  # noqa: E402 — import AFTER django.setup()

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})

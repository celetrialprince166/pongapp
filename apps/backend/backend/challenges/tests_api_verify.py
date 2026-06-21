from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User, PlayerProfile
from challenges.models import Challenge
import traceback

class NewAPITests(TestCase):
    def setUp(self):
        print("SETUP START")
        try:
            self.client = APIClient()
            self.user1, _ = User.objects.get_or_create(
                username='player1', 
                defaults={'password': 'password', 'email': 'player1@example.com'}
            )
            self.user2, _ = User.objects.get_or_create(
                username='player2', 
                defaults={'password': 'password', 'email': 'player2@example.com'}
            )
            self.user3, _ = User.objects.get_or_create(
                username='player3', 
                defaults={'password': 'password', 'email': 'player3@example.com'}
            )
            
            self.client.force_authenticate(user=self.user1)
        except Exception:
            traceback.print_exc()
            raise
        print("SETUP END")

    def test_random_player(self):
        url = reverse('random_player')
        response = self.client.get(url)
        if response.status_code != 200:
            print(f"Random Player Failed: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data['id'], self.user1.id)
        self.assertIn(response.data['username'], ['player2', 'player3'])

    def test_search_player(self):
        url = reverse('search_players')
        response = self.client.get(url, {'q': 'player2'})
        if response.status_code != 200:
            print(f"Search Player Failed: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        if 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['username'], 'player2')

    def test_create_challenge_with_config(self):
        url = reverse('challenges:challenge-list-create')
        data = {
            'challenged': self.user2.id,
            'message': 'Let\'s play!',
            'match_type': 'DUEL',
            'match_format': 'RACE_TO',
            'format_value': 21
        }
        response = self.client.post(url, data)
        if response.status_code != 201:
            print(f"Create Challenge Failed: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        challenge = Challenge.objects.get(id=response.data['id'])
        self.assertEqual(challenge.match_type, 'DUEL')
        self.assertEqual(challenge.match_format, 'RACE_TO')
        self.assertEqual(challenge.format_value, 21)

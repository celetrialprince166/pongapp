from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0007_add_match_format_and_bracket_winner'),
    ]

    operations = [
        migrations.CreateModel(
            name='TournamentRoundFormat',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('round_number', models.PositiveIntegerField()),
                ('round_name', models.CharField(max_length=50)),
                ('match_format', models.CharField(
                    choices=[
                        ('BEST_OF_3', 'Best of 3'),
                        ('BEST_OF_5', 'Best of 5'),
                        ('BEST_OF_7', 'Best of 7'),
                        ('RACE_TO_5', 'Race to 5'),
                        ('RACE_TO_11', 'Race to 11'),
                        ('RACE_TO_21', 'Race to 21'),
                    ],
                    default='BEST_OF_3',
                    max_length=20,
                )),
                ('tournament', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='round_formats',
                    to='tournaments.tournament',
                )),
            ],
            options={
                'ordering': ['round_number'],
                'unique_together': {('tournament', 'round_number')},
            },
        ),
    ]

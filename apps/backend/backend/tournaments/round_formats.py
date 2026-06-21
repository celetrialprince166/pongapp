# Default round format configurations per tournament format type

ROUND_FORMAT_DEFAULTS = {
    'SINGLE_ELIMINATION': {
        'early':  'BEST_OF_3',
        'quarter': 'BEST_OF_5',
        'semi':   'BEST_OF_7',
        'final':  'BEST_OF_7',
    },
    'DOUBLE_ELIMINATION': {
        'early':  'BEST_OF_3',
        'quarter': 'BEST_OF_5',
        'semi':   'BEST_OF_7',
        'final':  'BEST_OF_7',
    },
    'ROUND_ROBIN': {
        'all': 'BEST_OF_5',
    },
    'SWISS': {
        'all': 'BEST_OF_5',
    },
    'GROUP_KNOCKOUT': {
        'group':  'BEST_OF_3',
        'early':  'BEST_OF_5',
        'semi':   'BEST_OF_7',
        'final':  'BEST_OF_7',
    },
}


def get_default_format_for_round(tournament_format: str,
                                  round_number: int,
                                  total_rounds: int) -> str:
    """
    Returns the default match format for a given round.
    round_number: 1-indexed (1 = first round)
    total_rounds: total number of rounds in the tournament
    """
    defaults = ROUND_FORMAT_DEFAULTS.get(tournament_format, {})

    if tournament_format in ('ROUND_ROBIN', 'SWISS'):
        return defaults.get('all', 'BEST_OF_5')

    if tournament_format == 'GROUP_KNOCKOUT':
        if round_number == 1:
            return defaults.get('group', 'BEST_OF_3')
        rounds_from_end = total_rounds - round_number
        if rounds_from_end == 0:
            return defaults.get('final', 'BEST_OF_7')
        if rounds_from_end == 1:
            return defaults.get('semi', 'BEST_OF_7')
        return defaults.get('early', 'BEST_OF_5')

    # Single / Double Elimination
    rounds_from_end = total_rounds - round_number
    if rounds_from_end == 0:
        return defaults.get('final', 'BEST_OF_7')
    if rounds_from_end == 1:
        return defaults.get('semi', 'BEST_OF_7')
    if rounds_from_end == 2:
        return defaults.get('quarter', 'BEST_OF_5')
    return defaults.get('early', 'BEST_OF_3')


def get_format_for_tournament_round(tournament, round_number: int) -> str:
    """
    Look up the configured TournamentRoundFormat record for the given round.
    Falls back to get_default_format_for_round() if no record exists.
    Falls back to tournament.match_format if round count cannot be determined.
    """
    from tournaments.models import TournamentRoundFormat, TournamentRound

    try:
        rf = TournamentRoundFormat.objects.get(
            tournament=tournament,
            round_number=round_number
        )
        return rf.match_format
    except TournamentRoundFormat.DoesNotExist:
        total_rounds = TournamentRound.objects.filter(tournament=tournament).count()
        if total_rounds == 0:
            return tournament.match_format  # safe fallback
        return get_default_format_for_round(
            tournament.tournament_format,
            round_number,
            total_rounds
        )

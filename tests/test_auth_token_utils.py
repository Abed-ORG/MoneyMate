from datetime import datetime, timedelta, timezone

from app.auth.utils import (
    generate_secure_token,
    hash_security_token,
    token_is_expired,
)


def test_generated_security_tokens_are_random_and_hashable():
    first = generate_secure_token()
    second = generate_secure_token()

    assert first != second
    assert len(hash_security_token(first)) == 64
    assert hash_security_token(first) != hash_security_token(second)


def test_token_expiration_handles_aware_and_naive_datetimes():
    future = datetime.now(timezone.utc) + timedelta(minutes=5)
    past_naive = (
        datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
    )

    assert token_is_expired(future) is False
    assert token_is_expired(past_naive) is True
    assert token_is_expired(None) is True

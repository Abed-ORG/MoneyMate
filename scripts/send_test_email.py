import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.email_service import (  # noqa: E402
    EmailConfigurationError,
    EmailDeliveryError,
    send_test_email,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Send a MoneyMate email test using the current .env settings."
        )
    )
    parser.add_argument(
        "recipient",
        help="Email address that should receive the test message.",
    )
    args = parser.parse_args()

    try:
        send_test_email(args.recipient)
    except EmailConfigurationError as exc:
        print(f"Email configuration error: {exc}", file=sys.stderr)
        return 1
    except EmailDeliveryError as exc:
        print(f"Email delivery failed: {exc}", file=sys.stderr)
        return 1

    print(f"Sent MoneyMate test email to {args.recipient}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

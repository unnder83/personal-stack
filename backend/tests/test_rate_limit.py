from app.modules.auth.rate_limit import LoginRateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def test_blocked_after_max_failures():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_attempts=5, window_seconds=60, clock=clock)

    for _ in range(5):
        assert limiter.is_blocked("1.2.3.4") is False
        limiter.record_failure("1.2.3.4")

    assert limiter.is_blocked("1.2.3.4") is True


def test_window_expiry_unblocks():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_attempts=5, window_seconds=60, clock=clock)

    for _ in range(5):
        limiter.record_failure("1.2.3.4")
    assert limiter.is_blocked("1.2.3.4") is True

    clock.advance(61)

    assert limiter.is_blocked("1.2.3.4") is False


def test_reset_clears_failures():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_attempts=5, window_seconds=60, clock=clock)

    for _ in range(5):
        limiter.record_failure("1.2.3.4")
    limiter.reset("1.2.3.4")

    assert limiter.is_blocked("1.2.3.4") is False


def test_failures_are_tracked_per_key():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_attempts=5, window_seconds=60, clock=clock)

    for _ in range(5):
        limiter.record_failure("1.2.3.4")

    assert limiter.is_blocked("5.6.7.8") is False

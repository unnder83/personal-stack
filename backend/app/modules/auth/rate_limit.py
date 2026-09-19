import time
from collections import deque
from collections.abc import Callable


class LoginRateLimiter:
    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 60,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}

    def _prune(self, key: str) -> deque[float]:
        now = self._clock()
        entries = self._failures.setdefault(key, deque())
        while entries and now - entries[0] > self.window_seconds:
            entries.popleft()
        return entries

    def is_blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_attempts

    def record_failure(self, key: str) -> None:
        self._prune(key).append(self._clock())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def reset_all(self) -> None:
        self._failures.clear()


login_limiter = LoginRateLimiter()

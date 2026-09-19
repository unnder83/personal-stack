import time
from collections import deque
from collections.abc import Callable


class LoginRateLimiter:
    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 60,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10000,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}

    def _prune(self, key: str) -> deque[float]:
        now = self._clock()
        entries = self._failures.get(key)
        if entries is None:
            return deque()
        while entries and now - entries[0] > self.window_seconds:
            entries.popleft()
        if not entries:
            self._failures.pop(key, None)
        return entries

    def _evict(self, now: float) -> None:
        expired = [
            key
            for key, entries in self._failures.items()
            if not entries or now - entries[-1] > self.window_seconds
        ]
        for key in expired:
            del self._failures[key]
        while len(self._failures) >= self.max_keys:
            del self._failures[next(iter(self._failures))]

    def is_blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_attempts

    def record_failure(self, key: str) -> None:
        self._evict(self._clock())
        self._failures.setdefault(key, deque()).append(self._clock())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def reset_all(self) -> None:
        self._failures.clear()

    def tracked_key_count(self) -> int:
        return len(self._failures)


login_limiter = LoginRateLimiter()

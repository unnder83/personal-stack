from app.core.config import settings
from app.scripts.seed_admin import run


async def test_seed_script_requires_env(monkeypatch, capsys):
    monkeypatch.setattr(settings, "admin_username", None)
    monkeypatch.setattr(settings, "admin_password", None)

    exit_code = await run()

    captured = capsys.readouterr()
    assert exit_code == 1
    assert "ADMIN_USERNAME" in captured.err

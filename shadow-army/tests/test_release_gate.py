from pathlib import Path


def test_isolated_web_surface_exists():
    root = Path(__file__).resolve().parents[2]
    page = root / "shadow-army-web" / "index.html"
    assert page.exists()
    text = page.read_text(encoding="utf-8")
    assert "Теневая армия" in text
    assert "Командир" in text and "Хранитель" in text and "Управляющий" in text


def test_release_contract_does_not_replace_root_dashboard():
    root = Path(__file__).resolve().parents[2]
    release = (root / "shadow-army" / "RELEASE_V01.md").read_text(encoding="utf-8")
    assert "must not replace root pages" in release

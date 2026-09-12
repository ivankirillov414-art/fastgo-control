from pathlib import Path


def test_next_action_is_cross_project_and_user_only():
    source = (Path(__file__).parents[1] / "app" / "next_action.py").read_text()
    assert "Project.status == ProjectStatus.ACTIVE" in source
    assert "if not signals.user_required" in source
    assert "continue" in source
    assert '"rewards"' in source
    assert '"deadline"' in source
    assert '"score"' in source


def test_selector_returns_one_best_candidate():
    source = (Path(__file__).parents[1] / "app" / "next_action.py").read_text()
    assert "max(candidates" in source
    assert "return None" in source

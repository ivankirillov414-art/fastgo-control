from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.keeper import KeeperService
from app.models import Memory, MemoryType


def memory(subject: str, statement: str, kind: MemoryType = MemoryType.FACT, valid_until=None):
    return Memory(id=f"{subject}-{statement}", subject=subject, statement=statement, type=kind, confidence=0.9, importance=80, verification_status="verified", valid_until=valid_until)


def test_context_pack_detects_conflicting_facts():
    keeper = KeeperService(MagicMock())
    keeper.search = MagicMock(return_value=[memory("motor", "500 W"), memory("motor", "750 W")])
    pack = keeper.context_pack("motor")
    assert len(pack["conflicts"]) == 1
    assert len(pack["facts"]) == 2


def test_context_pack_separates_stale_memory():
    keeper = KeeperService(MagicMock())
    expired = memory("price", "5000 RUB", valid_until=datetime.now(timezone.utc) - timedelta(days=1))
    keeper.search = MagicMock(return_value=[expired])
    pack = keeper.context_pack("price")
    assert pack["facts"] == []
    assert len(pack["stale"]) == 1

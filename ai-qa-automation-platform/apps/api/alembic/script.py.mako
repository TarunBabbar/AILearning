"""Alembic migration template."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "${message}"
down_revision: Union[str, None] = "${down_revision}"
branch_labels: Union[str, Sequence[str], None] = "${branch_labels}"
depends_on: Union[str, Sequence[str], None] = "${depends_on}"


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}

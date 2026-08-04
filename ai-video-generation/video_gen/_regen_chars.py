"""Regenerate Mom & Son with normal heads (new design)."""
from cartoon_gen.config import cfg
from cartoon_gen.character_gen import generate_character

cfg.skip_existing = False  # force regen (do NOT reuse old food-head images)
for name in ("mom", "son"):
    p = generate_character(name)
    print("generated:", p)

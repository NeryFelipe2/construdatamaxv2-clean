#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BANCO DE DADOS — SQLite para persistência
"""

import sys
from pathlib import Path

# Adicionar pasta pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import BancoDeDados

__all__ = ["BancoDeDados"]

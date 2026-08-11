#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONSTRUDATA SABESP v5.0 — Pacote Modular
Inspirado no Bentley SewerCAD (arquitetura modular)
"""

from .models import PV, Trecho, Rede, TipoPV, MaterialTubo, StatusHidraulico
from .database import BancoDeDados

__version__ = "5.1.0"
__author__ = "Felipe Nery - FCN Construções e Saneamento"
__description__ = "Pipeline unificado para geração de Notas de Serviço SABESP"

__all__ = [
    "PV",
    "Trecho",
    "Rede",
    "TipoPV",
    "MaterialTubo",
    "StatusHidraulico",
    "BancoDeDados",
]

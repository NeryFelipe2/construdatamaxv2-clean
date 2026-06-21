import pytest


def test_gui_master_importa():
    pytest.importorskip("tkinter")
    import planejamento.gui_master as g
    assert hasattr(g, "construir_app") and hasattr(g, "main")

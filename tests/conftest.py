import pandas as pd
import pytest


@pytest.fixture
def single_answer_df():
    """Single-answer categorical columns plus a scale column."""
    return pd.DataFrame({
        'Gender': ['1', '2', '1', '2', '1', '2'],
        'Region': ['1', '1', '2', '3', '3', '2'],
        'Age': ['25', '30', '35', '40', '45', '50'],
    })


@pytest.fixture
def multiple_answer_df():
    """Semicolon-delimited multiple-answer column."""
    return pd.DataFrame({
        'Brands': ['1;3', '2', '3;5', '1;2;3', '', '5'],
        'Gender': ['1', '2', '1', '2', '1', '2'],
    })


@pytest.fixture
def weighted_df():
    return pd.DataFrame({
        'Gender': ['1', '2', '1', '2'],
        'Satisfaction': ['5', '4', '3', '5'],
        'Weight': ['1.0', '2.0', '1.5', '2.5'],
    })


@pytest.fixture
def crosstab_df():
    return pd.DataFrame({
        'Gender': ['1', '2', '1', '2', '1', '2', '1', '2'],
        'Satisfaction': ['5', '4', '5', '3', '4', '5', '3', '4'],
    })


@pytest.fixture(autouse=True)
def reset_backend_state():
    """Reset in-memory backend state before every test."""
    from opentab.api import data as data_module
    from opentab.api import tables as tables_module

    data_module.data_store['df'] = None
    data_module.data_store['metadata'] = {}
    data_module.data_store['file_name'] = None
    data_module.data_store['merged_variables'] = {}
    data_module.data_store.pop('net_registry', None)

    tables_module.tables_store.clear()

    yield

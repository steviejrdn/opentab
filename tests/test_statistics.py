import pandas as pd
import pytest

from opentab.core.statistics import calculate_frequencies, format_table_for_html


def _crosstab():
    return pd.DataFrame(
        {
            'A': [1, 3, 4],
            'B': [2, 0, 2],
            'Total': [3, 3, 6],
        },
        index=pd.Index(['Row1', 'Row2', 'Total']),
    )


def test_row_percentages():
    stats = calculate_frequencies(_crosstab())
    row_pct = stats['row_pct']
    assert row_pct.loc['Row1', 'A'] == pytest.approx(100 / 3)
    assert row_pct.loc['Row1', 'B'] == pytest.approx(200 / 3)
    assert row_pct.loc['Row1', 'Total'] == 100.0


def test_column_percentages():
    stats = calculate_frequencies(_crosstab())
    col_pct = stats['col_pct']
    assert col_pct.loc['Row1', 'A'] == pytest.approx(25)
    assert col_pct.loc['Row2', 'A'] == pytest.approx(75)
    assert col_pct.loc['Row1', 'B'] == 100.0


def test_total_percentages():
    stats = calculate_frequencies(_crosstab())
    total_pct = stats['total_pct']
    assert total_pct.loc['Row1', 'A'] == pytest.approx(100 / 6)
    assert total_pct.loc['Row1', 'B'] == pytest.approx(200 / 6)


def test_zero_total_does_not_divide_by_zero():
    df = pd.DataFrame(
        {'A': [0, 0], 'B': [0, 0], 'Total': [0, 0]},
        index=['Row1', 'Total'],
    )
    stats = calculate_frequencies(df)
    assert stats['row_pct'].loc['Row1', 'A'] == 0
    assert stats['col_pct'].loc['Row1', 'A'] == 0
    assert stats['total_pct'].loc['Row1', 'A'] == 0


def test_format_counts_only():
    stats = calculate_frequencies(_crosstab())
    html = format_table_for_html(stats, show_counts=True)
    assert '<table' in html


def test_format_with_row_pct():
    stats = calculate_frequencies(_crosstab())
    html = format_table_for_html(stats, show_counts=True, show_row_pct=True)
    assert '100.0' in html

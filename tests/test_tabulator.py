import pandas as pd

from opentab.core.tabulator import create_crosstab, calculate_base


def _gender_row_defs():
    return [
        {'name': 'Gender', 'label': 'Gender/1', 'code_def': 'Gender/1'},
        {'name': 'Gender', 'label': 'Gender/2', 'code_def': 'Gender/2'},
    ]


def _satisfaction_col_defs():
    return [
        {'name': 'Satisfaction', 'label': 'Satisfaction/3', 'code_def': 'Satisfaction/3'},
        {'name': 'Satisfaction', 'label': 'Satisfaction/4', 'code_def': 'Satisfaction/4'},
        {'name': 'Satisfaction', 'label': 'Satisfaction/5', 'code_def': 'Satisfaction/5'},
    ]


def test_crosstab_counts(crosstab_df):
    ct = create_crosstab(crosstab_df, _gender_row_defs(), _satisfaction_col_defs())

    assert ct.loc['Gender/1', 'Satisfaction/3'] == 1
    assert ct.loc['Gender/1', 'Satisfaction/4'] == 1
    assert ct.loc['Gender/1', 'Satisfaction/5'] == 2
    assert ct.loc['Gender/2', 'Satisfaction/3'] == 1
    assert ct.loc['Gender/2', 'Satisfaction/4'] == 2
    assert ct.loc['Gender/2', 'Satisfaction/5'] == 1


def test_crosstab_totals(crosstab_df):
    ct = create_crosstab(crosstab_df, _gender_row_defs(), _satisfaction_col_defs())

    assert ct.loc['Total', 'Satisfaction/3'] == 2
    assert ct.loc['Total', 'Satisfaction/4'] == 3
    assert ct.loc['Total', 'Satisfaction/5'] == 3
    assert ct.loc['Gender/1', 'Total'] == 4
    assert ct.loc['Gender/2', 'Total'] == 4
    assert ct.loc['Total', 'Total'] == 8


def test_crosstab_weighted(weighted_df):
    row_defs = [
        {'name': 'Gender', 'label': 'Gender/1', 'code_def': 'Gender/1'},
        {'name': 'Gender', 'label': 'Gender/2', 'code_def': 'Gender/2'},
    ]
    col_defs = [
        {'name': 'Satisfaction', 'label': 'Satisfaction/5', 'code_def': 'Satisfaction/5'},
    ]
    ct = create_crosstab(weighted_df, row_defs, col_defs, weight_col='Weight')

    # Gender/1 x Satisfaction/5: row 0 (w=1.0) -> 1.0
    assert ct.loc['Gender/1', 'Satisfaction/5'] == 1.0
    # Gender/2 x Satisfaction/5: row 3 (w=2.5) -> 2.5
    assert ct.loc['Gender/2', 'Satisfaction/5'] == 2.5
    # Total weight = 1 + 2 + 1.5 + 2.5 = 7.0
    assert ct.loc['Total', 'Total'] == 7.0


def test_crosstab_with_filter(crosstab_df):
    ct = create_crosstab(
        crosstab_df, _gender_row_defs(), _satisfaction_col_defs(),
        filter_def='Satisfaction/4+Satisfaction/5',
    )
    # Filtered to Satisfaction 4 or 5 (indices 0,1,2,4,5,7) -> 6 rows
    assert ct.loc['Total', 'Total'] == 6
    assert ct.loc['Total', 'Satisfaction/3'] == 0


def test_duplicate_labels_get_suffixed():
    df = pd.DataFrame({'Q': ['1', '2', '1', '2']})
    col_defs = [
        {'name': 'Q', 'label': 'Q/1', 'code_def': 'Q/1'},
        {'name': 'Q', 'label': 'Q/1', 'code_def': 'Q/1'},
    ]
    row_defs = [{'name': 'Q', 'label': 'Q/1', 'code_def': 'Q/1'}]
    ct = create_crosstab(df, row_defs, col_defs)
    assert list(ct.columns) == ['Q/1', 'Q/1 (2)', 'Total']


def test_calculate_base(crosstab_df):
    assert calculate_base(crosstab_df) == 8
    assert calculate_base(crosstab_df, filter_def='Gender/1') == 4

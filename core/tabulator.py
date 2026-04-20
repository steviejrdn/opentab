import pandas as pd
from core.code_parser import parse_code_def


def create_crosstab(df, row_defs, col_defs, weight_col=None, filter_def=None):
    if filter_def:
        filter_mask = parse_code_def(filter_def, df)
        df = df[filter_mask]

    row_masks = {}
    for row_def in row_defs:
        name = row_def['name']
        code_def = row_def['code_def']
        row_masks[name] = parse_code_def(code_def, df)

    col_masks = {}
    for col_def in col_defs:
        name = col_def['name']
        code_def = col_def['code_def']
        col_masks[name] = parse_code_def(code_def, df)

    crosstab_data = {}
    for row_name, row_mask in row_masks.items():
        row_data = {}
        for col_name, col_mask in col_masks.items():
            intersection = row_mask & col_mask
            if weight_col and weight_col in df.columns:
                count = df.loc[intersection, weight_col].astype(float).sum()
            else:
                count = intersection.sum()
            row_data[col_name] = count

        if weight_col and weight_col in df.columns:
            row_total = df.loc[row_mask, weight_col].astype(float).sum()
        else:
            row_total = row_mask.sum()
        row_data['Total'] = row_total

        crosstab_data[row_name] = row_data

    crosstab_df = pd.DataFrame(crosstab_data).T

    col_totals = {}
    for col_name in col_masks.keys():
        if weight_col and weight_col in df.columns:
            col_totals[col_name] = df.loc[col_masks[col_name], weight_col].astype(float).sum()
        else:
            col_totals[col_name] = col_masks[col_name].sum()

    if weight_col and weight_col in df.columns:
        col_totals['Total'] = df[weight_col].astype(float).sum()
    else:
        col_totals['Total'] = len(df)

    crosstab_df.loc['Total'] = col_totals

    return crosstab_df


def build_mask(code_def, df):
    return parse_code_def(code_def, df)


def calculate_base(df, filter_def=None):
    if filter_def:
        mask = parse_code_def(filter_def, df)
        return mask.sum()
    return len(df)

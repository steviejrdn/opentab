import pandas as pd
from .code_parser import parse_code_def, evaluate_code_def


def _make_unique(labels):
    seen = {}
    result = []
    for label in labels:
        n = seen.get(label, 0)
        result.append(label if n == 0 else f"{label} ({n + 1})")
        seen[label] = n + 1
    return result


def create_crosstab(df, row_defs, col_defs, weight_col=None, filter_def=None):
    if filter_def:
        filter_mask = parse_code_def(filter_def, df)
        df = df[filter_mask]

    weight_series = df[weight_col].astype(float) if (weight_col and weight_col in df.columns) else None

    row_masks = []
    for row_def in row_defs:
        name = row_def.get('label', row_def['name'])
        mask = evaluate_code_def(row_def['code_def'], df)
        row_masks.append((name, mask))

    col_masks = []
    for col_def in col_defs:
        name = col_def.get('label', col_def['name'])
        mask = evaluate_code_def(col_def['code_def'], df)
        col_masks.append((name, mask))

    data = []
    row_names = []
    for row_name, row_mask in row_masks:
        row_data = []
        for col_name, col_mask in col_masks:
            intersection = row_mask & col_mask
            if weight_series is not None:
                count = weight_series[intersection].sum()
            else:
                count = intersection.sum()
            row_data.append(count)

        if weight_series is not None:
            row_total = weight_series[row_mask].sum()
        else:
            row_total = row_mask.sum()
        row_data.append(row_total)

        data.append(row_data)
        row_names.append(row_name)

    col_names = _make_unique([name for name, _ in col_masks]) + ['Total']
    row_names = _make_unique(row_names)

    crosstab_df = pd.DataFrame(data, index=row_names, columns=col_names)

    total_row = []
    for col_name, col_mask in col_masks:
        if weight_series is not None:
            total_row.append(weight_series[col_mask].sum())
        else:
            total_row.append(col_mask.sum())

    if weight_series is not None:
        total_row.append(weight_series.sum())
    else:
        total_row.append(len(df))

    crosstab_df.loc['Total'] = total_row

    return crosstab_df


def build_mask(code_def, df):
    return parse_code_def(code_def, df)


def calculate_base(df, filter_def=None):
    if filter_def:
        mask = parse_code_def(filter_def, df)
        return mask.sum()
    return len(df)

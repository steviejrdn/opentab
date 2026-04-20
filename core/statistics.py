import pandas as pd


def calculate_frequencies(crosstab_df):
    stats_df = crosstab_df.copy()

    total_base = stats_df.loc['Total', 'Total']

    row_pct = _calculate_row_percentages(crosstab_df)
    col_pct = _calculate_column_percentages(crosstab_df)
    total_pct = _calculate_total_percentages(crosstab_df, total_base)

    return {
        'counts': crosstab_df,
        'row_pct': row_pct,
        'col_pct': col_pct,
        'total_pct': total_pct
    }


def _calculate_row_percentages(crosstab_df):
    row_pct = crosstab_df.copy()
    for idx in row_pct.index:
        row_total = crosstab_df.loc[idx, 'Total']
        if row_total > 0:
            row_pct.loc[idx] = (crosstab_df.loc[idx] / row_total) * 100
        else:
            row_pct.loc[idx] = 0
    return row_pct


def _calculate_column_percentages(crosstab_df):
    col_pct = crosstab_df.copy()
    for col in col_pct.columns:
        col_total = crosstab_df.loc['Total', col]
        if col_total > 0:
            col_pct[col] = (crosstab_df[col] / col_total) * 100
        else:
            col_pct[col] = 0
    return col_pct


def _calculate_total_percentages(crosstab_df, total_base):
    total_pct = crosstab_df.copy()
    if total_base > 0:
        total_pct = (crosstab_df / total_base) * 100
    else:
        total_pct = crosstab_df * 0
    return total_pct


def format_table_for_html(stats, show_counts=True, show_row_pct=False, show_col_pct=False, show_total_pct=False):
    counts = stats['counts'].round(1)

    if not any([show_row_pct, show_col_pct, show_total_pct]):
        return counts.to_html()

    combined = counts.astype(object).copy()

    if show_row_pct:
        row_pct = stats['row_pct'].round(1)
        for idx in combined.index:
            for col in combined.columns:
                combined.loc[idx, col] = f"{combined.loc[idx, col]} ({row_pct.loc[idx, col]})"

    if show_col_pct:
        col_pct = stats['col_pct'].round(1)
        for idx in combined.index:
            for col in combined.columns:
                current = combined.loc[idx, col]
                pct_val = col_pct.loc[idx, col]
                if isinstance(current, str):
                    combined.loc[idx, col] = f"{current} / {pct_val}"
                else:
                    combined.loc[idx, col] = f"{current} ({pct_val})"

    if show_total_pct:
        total_pct = stats['total_pct'].round(1)
        for idx in combined.index:
            for col in combined.columns:
                current = combined.loc[idx, col]
                pct_val = total_pct.loc[idx, col]
                if isinstance(current, str):
                    combined.loc[idx, col] = f"{current} / {pct_val}"
                else:
                    combined.loc[idx, col] = f"{current} ({pct_val})"

    return combined.to_html()

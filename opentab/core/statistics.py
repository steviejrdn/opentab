import pandas as pd


def calculate_frequencies(crosstab_df):
    float_df = crosstab_df.astype(float)
    total_base = float_df.loc['Total', 'Total']

    row_pct = _calculate_row_percentages(float_df)
    col_pct = _calculate_column_percentages(float_df)
    total_pct = _calculate_total_percentages(float_df, total_base)

    return {
        'counts': crosstab_df,
        'row_pct': row_pct,
        'col_pct': col_pct,
        'total_pct': total_pct
    }


def _calculate_row_percentages(df):
    row_totals = df['Total']
    row_pct = df.div(row_totals, axis=0) * 100
    return row_pct.fillna(0)


def _calculate_column_percentages(df):
    col_totals = df.loc['Total']
    col_pct = df.div(col_totals, axis=1) * 100
    return col_pct.fillna(0)


def _calculate_total_percentages(df, total_base):
    if total_base > 0:
        return (df / total_base) * 100
    return df * 0


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

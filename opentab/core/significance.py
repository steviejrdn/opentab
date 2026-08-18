"""Column-comparison significance testing for survey crosstabs.

Pure functions only — no FastAPI/scipy dependencies. Significance is always
computed on UNWEIGHTED counts: weights inflate apparent precision and would
make the letter notation statistically misleading. When no weight column is
selected, the unweighted counts equal the displayed counts.
"""
import math


def normal_cdf(x: float) -> float:
    """Standard normal cumulative distribution function (via math.erf)."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def z_test_two_proportions(c1, n1, c2, n2):
    """Two-tailed z-test p-value for equality of two proportions.

    Returns None when the test cannot be computed (empty bases or degenerate
    pooled proportion).
    """
    if n1 <= 0 or n2 <= 0:
        return None
    p1 = c1 / n1
    p2 = c2 / n2
    p = (c1 + c2) / (n1 + n2)
    if p <= 0 or p >= 1:
        return None
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    if se == 0:
        return None
    z = (p1 - p2) / se
    return 2 * (1 - normal_cdf(abs(z)))


def _excel_letters(i):
    """0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ... (chr-based, no upper bound)."""
    letters = ''
    i += 1
    while i > 0:
        i, rem = divmod(i - 1, 26)
        letters = chr(ord('A') + rem) + letters
    return letters


def compute_proportion_significance(counts_df, col_bases):
    """Higher-only column-comparison letters with confidence tiers.

    A cell only shows a letter for columns it is significantly HIGHER than.
    The letter style encodes the confidence level:
        lowercase (e.g. "b") = significantly higher at 90% (not 95%).
        UPPERCASE (e.g. "B") = significantly higher at 95% (not 99%).
        UPPERCASE + "+" (e.g. "B+") = significantly higher at 99%.

    Args:
        counts_df: UNWEIGHTED crosstab DataFrame (rows x columns), including
            the 'Total' row and 'Total' column.
        col_bases: dict {column_name: unweighted_base_n} for banner columns
            (exclude 'Total').

    Returns:
        (column_letters, letters) where column_letters maps each banner column
        to its letter (A, B, C, ...) and letters maps each data row to a dict
        {column_name: 'B+c' string} of columns this cell is significantly
        higher than.
    """
    cols = [c for c in counts_df.columns if c != 'Total']
    letter_of = {c: _excel_letters(i) for i, c in enumerate(cols)}
    rows = [r for r in counts_df.index if r != 'Total']

    letters = {}
    for r in rows:
        row_map = {}
        for i, ci in enumerate(cols):
            n1 = float(col_bases[ci])
            if n1 <= 0:
                continue
            c1 = float(counts_df.loc[r, ci])
            p1 = c1 / n1
            parts = []  # (tier, col_index, letter_string); tier: 99%->2, 95%->1, 90%->0
            for j, cj in enumerate(cols):
                if i == j:
                    continue
                n2 = float(col_bases[cj])
                if n2 <= 0:
                    continue
                c2 = float(counts_df.loc[r, cj])
                if p1 <= c2 / n2:
                    continue  # not higher, skip
                pval = z_test_two_proportions(c1, n1, c2, n2)
                if pval is None:
                    continue
                l = letter_of[cj]
                if pval < 0.01:
                    parts.append((2, j, l.upper() + '+'))
                elif pval < 0.05:
                    parts.append((1, j, l.upper()))
                elif pval < 0.10:
                    parts.append((0, j, l.lower()))
            if parts:
                # 99% first, then 95%, then 90%; within each tier by column order.
                parts.sort(key=lambda x: (-x[0], x[1]))
                row_map[ci] = ''.join(p[2] for p in parts)
        if row_map:
            letters[r] = row_map
    return letter_of, letters


def compute_total_significance(counts_df, col_bases):
    """Directional test of each column against the rest (Total minus the column).

    A cell is marked with an arrow when its column proportion is significantly
    different (at 95%) from the proportion across all OTHER columns (Total
    excluding itself, so the two groups are independent):
        '↑' = significantly higher than Total.
        '↓' = significantly lower than Total.

    Returns:
        markers: {row_name: {column_name: '↑' | '↓'}}.
    """
    cols = [c for c in counts_df.columns if c != 'Total']
    rows = [r for r in counts_df.index if r != 'Total']
    total_base = float(counts_df.loc['Total', 'Total'])

    markers = {}
    for r in rows:
        total_count = float(counts_df.loc[r, 'Total'])
        row_map = {}
        for ci in cols:
            n_i = float(col_bases[ci])
            c_i = float(counts_df.loc[r, ci])
            n_rest = total_base - n_i
            c_rest = total_count - c_i
            if n_i <= 0 or n_rest <= 0:
                continue
            p_i = c_i / n_i
            p_rest = c_rest / n_rest
            pval = z_test_two_proportions(c_i, n_i, c_rest, n_rest)
            if pval is not None and pval < 0.05:
                row_map[ci] = '↑' if p_i > p_rest else '↓'
        if row_map:
            markers[r] = row_map
    return markers

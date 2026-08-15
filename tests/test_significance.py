import math

import pandas as pd
import pytest

from opentab.core.significance import (
    _excel_letters,
    compute_proportion_significance,
    compute_total_significance,
    normal_cdf,
    z_test_two_proportions,
)


class TestZTestTwoProportions:
    def test_significant_difference(self):
        # 50/100 vs 30/100 should be a significant difference (p < 0.05)
        p = z_test_two_proportions(50, 100, 30, 100)
        assert p is not None
        assert p < 0.05

    def test_identical_proportions_return_p_one(self):
        p = z_test_two_proportions(50, 100, 50, 100)
        assert p == pytest.approx(1.0)

    def test_zero_or_negative_base_returns_none(self):
        assert z_test_two_proportions(10, 0, 5, 100) is None
        assert z_test_two_proportions(10, 100, 5, 0) is None
        assert z_test_two_proportions(10, -1, 5, 100) is None

    def test_all_zero_counts_returns_none(self):
        # pooled proportion of 0 cannot be tested
        assert z_test_two_proportions(0, 100, 0, 100) is None

    def test_is_symmetric(self):
        forward = z_test_two_proportions(50, 100, 30, 100)
        backward = z_test_two_proportions(30, 100, 50, 100)
        assert forward == pytest.approx(backward)


class TestNormalCdf:
    def test_bounds(self):
        assert normal_cdf(0) == pytest.approx(0.5)
        assert normal_cdf(1.96) == pytest.approx(0.975, abs=0.001)
        assert normal_cdf(-1.96) == pytest.approx(0.025, abs=0.001)

    def test_uses_math_erf(self):
        x = 1.5
        expected = 0.5 * (1 + math.erf(x / math.sqrt(2)))
        assert normal_cdf(x) == pytest.approx(expected)


class TestExcelLetters:
    def test_single_letters(self):
        assert _excel_letters(0) == 'A'
        assert _excel_letters(25) == 'Z'

    def test_beyond_z(self):
        assert _excel_letters(26) == 'AA'
        assert _excel_letters(27) == 'AB'
        assert _excel_letters(51) == 'AZ'
        assert _excel_letters(52) == 'BA'


class TestComputeProportionSignificance:
    def test_higher_only_direction(self):
        counts_df = pd.DataFrame(
            {
                'A': [50, 100],
                'B': [30, 100],
                'C': [80, 100],
                'Total': [160, 300],
            },
            index=['Q1', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100, 'C': 100}

        column_letters, letters = compute_proportion_significance(counts_df, col_bases)

        assert column_letters == {'A': 'A', 'B': 'B', 'C': 'C'}
        # A (50%) is higher than B (30%) at 99% -> 'B+'; lower than C -> no letter.
        assert letters['Q1']['A'] == 'B+'
        # B (30%) is lower than both A and C -> no letters.
        assert 'B' not in letters['Q1']
        # C (80%) is higher than A and B at 99% -> 'A+B+'
        assert letters['Q1']['C'] == 'A+B+'

    def test_confidence_tiers(self):
        # A is fixed at 50%; vary B to hit each confidence tier.
        def letters_for(b_pct):
            counts_df = pd.DataFrame(
                {'A': [50, 100], 'B': [b_pct, 100], 'Total': [50 + b_pct, 200]},
                index=['Q1', 'Total'],
            )
            _, letters = compute_proportion_significance(counts_df, {'A': 100, 'B': 100})
            return letters.get('Q1', {}).get('A', '')

        # 50% vs 30% -> p < 0.01 -> "B+"
        assert letters_for(30) == 'B+'
        # 50% vs 36% -> p ~ 0.045 -> "B"
        assert letters_for(36) == 'B'
        # 50% vs 38% -> p ~ 0.087 -> "b"
        assert letters_for(38) == 'b'
        # 50% vs 44% -> p ~ 0.4 -> no letter
        assert letters_for(44) == ''

    def test_no_difference_yields_empty_letters(self):
        counts_df = pd.DataFrame(
            {
                'A': [50, 100],
                'B': [50, 100],
                'C': [50, 100],
                'Total': [150, 300],
            },
            index=['Q1', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100, 'C': 100}

        column_letters, letters = compute_proportion_significance(counts_df, col_bases)

        assert column_letters == {'A': 'A', 'B': 'B', 'C': 'C'}
        assert letters == {}

    def test_zero_counts_row_produces_no_letters(self):
        counts_df = pd.DataFrame(
            {
                'A': [0, 100],
                'B': [0, 100],
                'Total': [0, 200],
            },
            index=['Q1', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100}

        _, letters = compute_proportion_significance(counts_df, col_bases)

        assert letters == {}

    def test_total_row_and_column_excluded(self):
        counts_df = pd.DataFrame(
            {
                'A': [50, 100, 150],
                'B': [30, 100, 130],
                'Total': [80, 200, 280],
            },
            index=['Q1', 'Q2', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100}

        column_letters, letters = compute_proportion_significance(counts_df, col_bases)

        assert column_letters == {'A': 'A', 'B': 'B'}
        assert 'Total' not in letters
        assert 'Total' not in column_letters

    def test_many_columns_get_sequential_letters(self):
        cols = {f'Col{i}': 100 for i in range(30)}
        data = {name: [50, 100] for name in cols}
        data['Total'] = [50 * 30, 100 * 30]
        counts_df = pd.DataFrame(data, index=['Q1', 'Total'])

        column_letters, _ = compute_proportion_significance(counts_df, cols)

        assert column_letters['Col0'] == 'A'
        assert column_letters['Col25'] == 'Z'
        assert column_letters['Col26'] == 'AA'
        assert column_letters['Col29'] == 'AD'


class TestComputeTotalSignificance:
    def test_column_differs_from_rest(self):
        counts_df = pd.DataFrame(
            {'A': [60, 100], 'B': [30, 100], 'C': [30, 100], 'Total': [120, 300]},
            index=['Q1', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100, 'C': 100}

        markers = compute_total_significance(counts_df, col_bases)

        # A (60%) vs rest (30%) -> significantly higher -> '↑'
        assert markers['Q1']['A'] == '↑'
        # B (30%) vs rest (45%) -> significantly lower -> '↓'
        assert markers['Q1']['B'] == '↓'
        assert markers['Q1']['C'] == '↓'

    def test_no_difference_from_rest(self):
        counts_df = pd.DataFrame(
            {'A': [50, 100], 'B': [50, 100], 'Total': [100, 200]},
            index=['Q1', 'Total'],
        )
        col_bases = {'A': 100, 'B': 100}

        markers = compute_total_significance(counts_df, col_bases)

        # A == B == Total -> no significant difference
        assert markers == {}

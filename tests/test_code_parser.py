import pandas as pd
import pytest

from opentab.core.code_parser import parse_code_def, evaluate_code_def, validate_code_def


@pytest.fixture
def df():
    return pd.DataFrame({
        'Gender': ['1', '2', '1', '2', '1', '2', '1', '2'],
        'Brands': ['1;3', '2', '3;5', '1;2;3', '', '5', '1', '2;4'],
        'Rating': ['1', '2', '3', '4', '5', '4', '3', '2'],
    })


def test_simple_code_match(df):
    mask = parse_code_def('Gender/1', df)
    assert mask.tolist() == [True, False, True, False, True, False, True, False]


def test_dollar_prefixed_variable(df):
    mask = parse_code_def('$Gender/2', df)
    assert mask.tolist() == [False, True, False, True, False, True, False, True]


def test_or_operator(df):
    mask = parse_code_def('Rating/1+Rating/2', df)
    assert mask.sum() == 3
    assert mask.tolist()[0] is True
    assert mask.tolist()[1] is True
    assert mask.tolist()[7] is True


def test_and_operator(df):
    # Every row where Gender==1 AND Rating==5
    mask = parse_code_def('Gender/1.Rating/5', df)
    assert mask.sum() == 1
    assert mask.tolist()[4] is True


def test_and_operator_cross_variable(df):
    mask = parse_code_def('Gender/1.Rating/3', df)
    assert mask.sum() == 2
    assert mask.tolist()[2] is True
    assert mask.tolist()[6] is True


def test_negate(df):
    mask = parse_code_def('!Gender/1', df)
    assert mask.tolist() == [False, True, False, True, False, True, False, True]


def test_any_non_empty(df):
    mask = parse_code_def('Brands/*', df)
    expected = [True, True, True, True, False, True, True, True]
    assert mask.tolist() == expected


def test_any_non_empty_negated(df):
    mask = parse_code_def('!Brands/*', df)
    expected = [False, False, False, False, True, False, False, False]
    assert mask.tolist() == expected


def test_range(df):
    mask = parse_code_def('Rating/2..4', df)
    assert mask.sum() == 6


def test_range_inclusive_bounds(df):
    mask = parse_code_def('Rating/1..5', df)
    assert mask.sum() == 8


def test_list_of_codes(df):
    mask = parse_code_def('Rating/1,3,5', df)
    assert mask.sum() == 4


def test_multiple_answer_contains(df):
    mask = parse_code_def('Brands/3', df)
    expected = [True, False, True, True, False, False, False, False]
    assert mask.tolist() == expected


def test_multiple_answer_list(df):
    mask = parse_code_def('Brands/1,2', df)
    # rows containing 1 or 2: 0,1,3,6,7
    assert mask.sum() == 5


def test_invalid_format_raises(df):
    with pytest.raises(ValueError):
        parse_code_def('not_a_valid_unit', df)


def test_unknown_variable_raises(df):
    with pytest.raises(ValueError):
        parse_code_def('Missing/1', df)


def test_range_start_greater_than_end_raises(df):
    with pytest.raises(ValueError):
        parse_code_def('Rating/5..1', df)


def test_evaluate_code_def_skips_validation(df):
    # parse_code_def rejects an inverted range via validate_code_def,
    # but evaluate_code_def skips that check and just matches nothing.
    with pytest.raises(ValueError):
        parse_code_def('Rating/5..1', df)
    mask = evaluate_code_def('Rating/5..1', df)
    assert mask.sum() == 0


def test_validate_code_def_returns_errors(df):
    errors = validate_code_def('Missing/1 + BadUnit', df)
    assert any('Missing' in e for e in errors)
    assert any('Invalid format' in e for e in errors)


def test_validate_code_def_valid(df):
    assert validate_code_def('Gender/1.Rating/2..4', df) == []


def test_validate_code_def_invalid_range(df):
    errors = validate_code_def('Rating/5..1', df)
    assert any('start > end' in e for e in errors)


def test_missing_code_does_not_error(df):
    # Missing codes are tolerated (they just match nothing).
    assert validate_code_def('Gender/99', df) == []
    mask = parse_code_def('Gender/99', df)
    assert mask.sum() == 0

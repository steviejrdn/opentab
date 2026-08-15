import json
import os

import pandas as pd

from opentab.core.data_loader import (
    detect_column_types,
    load_csv,
    merge_multiple_response,
    merge_spread_columns,
)


# ─── detect_column_types ───────────────────────────────────────────────────────

def test_boolean_column():
    df = pd.DataFrame({'flag': ['0', '1', '0', '1', '1']})
    meta = detect_column_types(df)
    assert meta['flag']['type'] == 'boolean'
    assert meta['flag']['answer_type'] == 'single_answer'


def test_numeric_column_few_codes():
    df = pd.DataFrame({'rating': ['1', '2', '3', '4', '5', '1', '2', '3', '4', '5']})
    meta = detect_column_types(df)
    assert meta['rating']['type'] == 'numeric'
    assert meta['rating']['answer_type'] == 'single_answer'


def test_scale_column_many_unique():
    df = pd.DataFrame({'age': [str(i) for i in range(1, 30)]})
    meta = detect_column_types(df)
    assert meta['age']['type'] == 'scale'
    assert 'stats' in meta['age']
    assert 'mean' in meta['age']['stats']


def test_multiple_answer_semicolon():
    df = pd.DataFrame({'brands': ['1;3', '2', '3;5', '1;2;3', '']})
    meta = detect_column_types(df)
    assert meta['brands']['type'] == 'categorical'
    assert meta['brands']['answer_type'] == 'multiple_answer'
    assert meta['brands']['response_count'] == 8


def test_curly_single_answer():
    df = pd.DataFrame({'q': ['{_1}', '{_2}', '{_1}', '{_3}']})
    meta = detect_column_types(df)
    assert meta['q']['answer_type'] == 'single_answer'
    # values are normalized to codes without braces
    assert set(df['q']) == {'1', '2', '3'}


def test_curly_multiple_answer():
    df = pd.DataFrame({'q': ['{_1,_2}', '{_2}', '{_1,_2,_3}', '{_3}']})
    meta = detect_column_types(df)
    assert meta['q']['answer_type'] == 'multiple_answer'
    assert df['q'][0] == '1;2'
    assert meta['q']['response_count'] == 7


def test_text_column():
    df = pd.DataFrame({'comment': ['great', 'ok', 'bad', 'fine']})
    meta = detect_column_types(df)
    assert meta['comment']['type'] == 'text'
    assert meta['comment']['codes'] == []


def test_empty_column():
    df = pd.DataFrame({'empty': [None, None, None]})
    meta = detect_column_types(df)
    assert meta['empty']['type'] == 'unknown'
    assert meta['empty']['codes'] == []


# ─── load_csv ──────────────────────────────────────────────────────────────────

def test_load_csv_renames_dots(tmp_path):
    csv_path = tmp_path / 'data.csv'
    csv_path.write_text('Q.1,Q2\n1,2\n3,4\n', encoding='utf-8')
    df, meta = load_csv(str(csv_path))
    assert 'Q_1' in df.columns
    assert 'Q2' in df.columns


def test_load_csv_applies_labels(tmp_path):
    csv_path = tmp_path / 'data.csv'
    csv_path.write_text('Satisfaction\n5\n4\n', encoding='utf-8')
    labels = {'Satisfaction': {'label': 'Overall satisfaction', 'codes': {'5': 'Very Satisfied'}}}
    (tmp_path / 'data_labels.json').write_text(json.dumps(labels), encoding='utf-8')

    df, meta = load_csv(str(csv_path))
    assert meta['Satisfaction']['label'] == 'Overall satisfaction'
    code_labels = {c['code']: c['label'] for c in meta['Satisfaction']['codes']}
    assert code_labels['5'] == 'Very Satisfied'


# ─── merge helpers ─────────────────────────────────────────────────────────────

def test_merge_multiple_response():
    df = pd.DataFrame({
        'q1_1': ['1', '0', '1'],
        'q1_2': ['0', '1', '1'],
        'q1_3': ['0', '0', '1'],
    })
    result = merge_multiple_response(df, ['q1_1', 'q1_2', 'q1_3'], 'q1')
    assert result.tolist() == ['1', '2', '1;2;3']


def test_merge_spread_columns():
    df = pd.DataFrame({
        'a': ['1', '', '3'],
        'b': ['2', '2', ''],
        'c': ['', '3', '3'],
    })
    result = merge_spread_columns(df, ['a', 'b', 'c'], 'merged')
    assert result.tolist() == ['1;2', '2;3', '3;3']

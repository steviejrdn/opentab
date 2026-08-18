import json
import os
import re
import pandas as pd
import chardet

_CURLY_RE = re.compile(r'^\{([^}]*)\}$')


def _parse_curly_codes(val):
    """Parse '{_1,_2,_3}' → ['1', '2', '3']. Returns None if not curly format."""
    m = _CURLY_RE.match(str(val))
    if not m:
        return None
    inner = m.group(1)
    return [p.lstrip('_') for p in inner.split(',') if p.strip()]


def _code_sort_key(x):
    return (int(x) if str(x).isdigit() else float('inf'), str(x))


def detect_encoding(path):
    with open(path, 'rb') as f:
        raw = f.read(10000)
        result = chardet.detect(raw)
        return result['encoding'] or 'utf-8'


def load_csv(path, encoding=None):
    if encoding is None:
        encoding = detect_encoding(path)
    df = pd.read_csv(path, encoding=encoding, dtype=str)
    df.columns = df.columns.str.replace('.', '_', regex=False)
    metadata = detect_column_types(df)

    labels_path = os.path.splitext(path)[0] + '_labels.json'
    if os.path.exists(labels_path):
        with open(labels_path, encoding='utf-8') as f:
            labels = json.load(f)
        for col, col_meta in labels.items():
            if col not in metadata:
                continue
            if 'label' in col_meta:
                metadata[col]['label'] = col_meta['label']
            if 'codes' in col_meta:
                code_labels = col_meta['codes']
                new_codes = []
                for c in metadata[col].get('codes', []):
                    if isinstance(c, dict):
                        code_val = str(c['code'])
                        fallback = c.get('label', code_val)
                    else:
                        try:
                            code_val = str(int(float(c)))
                        except (ValueError, TypeError):
                            code_val = str(c)
                        fallback = code_val
                    new_codes.append({'code': code_val, 'label': code_labels.get(code_val, fallback)})
                metadata[col]['codes'] = new_codes

    return df, metadata


def detect_column_types(df):
    metadata = {}
    base_count = len(df)

    for col in df.columns:
        non_null = df[col].dropna()
        if len(non_null) == 0:
            metadata[col] = {'type': 'unknown', 'answer_type': 'single_answer', 'codes': [], 'response_count': 0, 'base_count': base_count, 'is_valid': True}
            continue

        str_vals = non_null.astype(str)

        # --- Rule 1: {_N} survey coded format ---
        if str_vals.str.match(r'^\{[^}]*\}$').all():
            has_multi = str_vals.str.contains(',', regex=False).any()
            if has_multi:
                all_codes = set()
                response_count = 0
                for val in non_null:
                    codes = _parse_curly_codes(val) or []
                    all_codes.update(codes)
                    response_count += len(codes)
                df[col] = df[col].map(
                    lambda v: ';'.join(_parse_curly_codes(str(v))) if pd.notna(v) else v
                )
                metadata[col] = {
                    'type': 'categorical',
                    'answer_type': 'multiple_answer',
                    'codes': [{'code': c, 'label': c} for c in sorted(all_codes, key=_code_sort_key)],
                    'response_count': response_count,
                    'base_count': base_count,
                    'is_valid': True
                }
            else:
                unique_codes = sorted(
                    {_parse_curly_codes(v)[0] for v in non_null if _parse_curly_codes(v)},
                    key=_code_sort_key
                )
                df[col] = df[col].map(
                    lambda v: _parse_curly_codes(str(v))[0] if pd.notna(v) else v
                )
                metadata[col] = {
                    'type': 'categorical',
                    'answer_type': 'single_answer',
                    'codes': [{'code': c, 'label': c} for c in unique_codes],
                    'response_count': len(non_null),
                    'base_count': base_count,
                    'is_valid': len(non_null) == base_count
                }
            continue

        # --- Rule 2: Raw numeric → boolean / numeric / scale ---
        try:
            numeric_vals = pd.to_numeric(non_null, errors='coerce')
            if numeric_vals.isna().sum() == 0:
                unique_vals = sorted(numeric_vals.unique().tolist())
                unique_set = set(unique_vals)

                if unique_set.issubset({0, 1, 0.0, 1.0}):
                    metadata[col] = {
                        'type': 'boolean',
                        'answer_type': 'single_answer',
                        'codes': [{'code': str(int(v)), 'label': str(int(v))} for v in sorted(unique_set)],
                        'response_count': len(non_null),
                        'base_count': base_count,
                        'is_valid': len(non_null) == base_count
                    }
                elif len(unique_vals) > 10:
                    metadata[col] = {
                        'type': 'scale',
                        'answer_type': 'single_answer',
                        'codes': [],
                        'stats': {
                            'min': round(float(numeric_vals.min()), 2),
                            'max': round(float(numeric_vals.max()), 2),
                            'mean': round(float(numeric_vals.mean()), 2),
                            'median': round(float(numeric_vals.median()), 2),
                            'std': round(float(numeric_vals.std()), 2),
                        },
                        'response_count': len(non_null),
                        'base_count': base_count,
                        'is_valid': len(non_null) == base_count,
                    }
                else:
                    metadata[col] = {
                        'type': 'numeric',
                        'answer_type': 'single_answer',
                        'codes': unique_vals,
                        'response_count': len(non_null),
                        'base_count': base_count,
                        'is_valid': len(non_null) == base_count
                    }
                continue
        except Exception:
            pass

        # --- Rule 3: Semicolon-delimited multiple response (legacy CSV format) ---
        if str_vals.str.contains(';', regex=False).any():
            all_codes = set()
            response_count = 0
            for val in non_null:
                codes = [c.strip() for c in str(val).split(';') if c.strip()]
                all_codes.update(codes)
                response_count += len(codes)
            metadata[col] = {
                'type': 'categorical',
                'answer_type': 'multiple_answer',
                'codes': [{'code': c, 'label': c} for c in sorted(all_codes, key=_code_sort_key)],
                'response_count': response_count,
                'base_count': base_count,
                'is_valid': True
            }
            continue

        # --- Rule 4: Everything else → text (open-ended / dates / IDs / misc) ---
        metadata[col] = {
            'type': 'text',
            'answer_type': 'single_answer',
            'codes': [],
            'response_count': len(non_null),
            'base_count': base_count,
            'is_valid': len(non_null) == base_count
        }

    return metadata


def load_excel(path, sheet_name=0):
    df = pd.read_excel(path, sheet_name=sheet_name, dtype=str)
    df.columns = df.columns.str.replace('.', '_', regex=False)
    metadata = detect_column_types(df)
    return df, metadata


def load_sav(path):
    try:
        import pyreadstat
    except ImportError:
        raise ImportError("pyreadstat is required for .sav files: pip install pyreadstat")

    df, meta = pyreadstat.read_sav(path, apply_value_formats=False)

    # Build label mappings before renaming columns
    rename_map = {c: c.replace('.', '_') for c in df.columns}

    def _norm_key(k):
        try:
            return str(int(float(k)))
        except (ValueError, TypeError):
            return str(k)

    col_labels_list = meta.column_labels or []
    col_label_map = {
        rename_map.get(orig, orig): lbl
        for orig, lbl in zip(meta.column_names, col_labels_list)
        if lbl
    }
    val_label_map = {
        rename_map.get(orig, orig): {_norm_key(k): v for k, v in vl.items()}
        for orig, vl in (meta.variable_value_labels or {}).items()
    }

    df = df.rename(columns=rename_map)

    result = {}
    for col_name in df.columns:
        s = df[col_name]
        if pd.api.types.is_float_dtype(s) or pd.api.types.is_integer_dtype(s):
            out = pd.Series([None] * len(s), index=s.index, dtype=object)
            non_null = s.notna()
            is_whole = non_null & (s % 1 == 0)
            out[is_whole] = s[is_whole].astype('int64').astype(str)
            out[non_null & ~is_whole] = s[non_null & ~is_whole].astype(str)
            result[col_name] = out
        else:
            result[col_name] = s.where(s.notna(), other=None)
    df = pd.DataFrame(result)
    metadata = detect_column_types(df)

    for col in df.columns:
        if col not in metadata:
            continue
        if col in col_label_map:
            metadata[col]['label'] = col_label_map[col]
        if col in val_label_map:
            code_labels = val_label_map[col]
            new_codes = []
            for c in metadata[col].get('codes', []):
                if isinstance(c, dict):
                    code_val = str(c['code'])
                    fallback = c.get('label', code_val)
                else:
                    try:
                        code_val = str(int(float(c)))
                    except (ValueError, TypeError):
                        code_val = str(c)
                    fallback = code_val
                new_codes.append({'code': code_val, 'label': code_labels.get(code_val, fallback)})
            metadata[col]['codes'] = new_codes

    # SPSS variable_measure override: catch scale vars with ≤10 distinct values
    var_measure_map = {
        rename_map.get(orig, orig): measure
        for orig, measure in (meta.variable_measure or {}).items()
    }
    for col in df.columns:
        if col not in metadata:
            continue
        if var_measure_map.get(col) == 'scale' and metadata[col]['type'] == 'numeric':
            numeric_col = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(numeric_col) == 0:
                continue
            metadata[col]['type'] = 'scale'
            metadata[col]['codes'] = []
            metadata[col]['stats'] = {
                'min': round(float(numeric_col.min()), 2),
                'max': round(float(numeric_col.max()), 2),
                'mean': round(float(numeric_col.mean()), 2),
                'median': round(float(numeric_col.median()), 2),
                'std': round(float(numeric_col.std()), 2),
            }

    return df, metadata


def merge_multiple_response(df, source_columns, name):
    """Merge dichotomous (0/1) columns into a single semicolon-delimited multiple-response variable.

    Args:
        df: pandas DataFrame
        source_columns: list of column names in order (index 0 → code "1", index 1 → code "2", ...)
        name: name for the new merged column

    Returns:
        pandas Series with semicolon-delimited codes (e.g. "1;3;5") or empty string if none selected.
    """
    bool_df = pd.DataFrame(
        {col: df[col].astype(str).str.strip() == '1' for col in source_columns}
    )
    return bool_df.apply(
        lambda row: ';'.join(str(i + 1) for i, v in enumerate(row) if v),
        axis=1
    )


def merge_spread_columns(df, source_columns, name):
    """Merge spread/delimited columns into a single semicolon-delimited multiple-response variable.

    Args:
        df: pandas DataFrame
        source_columns: list of column names (e.g. Q1_1, Q1_2, Q1_3, ...)
        name: name for the new merged column

    Returns:
        pandas Series with semicolon-delimited codes (e.g. "1;2;3;4") or empty string if none selected.
    """
    def clean(series):
        s = series.astype(str).str.strip()
        return s.where(~s.str.lower().isin(['', 'nan', 'null', 'none']), other='')

    parts = pd.concat([clean(df[col]).rename(col) for col in source_columns], axis=1)
    return parts.apply(lambda row: ';'.join(v for v in row if v), axis=1)

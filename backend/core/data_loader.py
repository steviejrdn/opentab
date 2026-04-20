import pandas as pd
import chardet


def detect_encoding(path):
    with open(path, 'rb') as f:
        raw = f.read(10000)
        result = chardet.detect(raw)
        return result['encoding'] or 'utf-8'


def load_csv(path, encoding=None):
    if encoding is None:
        encoding = detect_encoding(path)
    df = pd.read_csv(path, encoding=encoding, dtype=str)
    metadata = detect_column_types(df)
    return df, metadata


def detect_column_types(df):
    metadata = {}
    for col in df.columns:
        non_null = df[col].dropna()
        if len(non_null) == 0:
            metadata[col] = {'type': 'unknown', 'codes': []}
            continue
        try:
            numeric_vals = pd.to_numeric(non_null, errors='coerce')
            if numeric_vals.isna().sum() == 0:
                metadata[col] = {
                    'type': 'numeric',
                    'codes': sorted(numeric_vals.unique().tolist())
                }
            else:
                unique_vals = non_null.unique().tolist()
                metadata[col] = {
                    'type': 'categorical',
                    'codes': [{'code': v, 'label': str(v)} for v in unique_vals]
                }
        except Exception:
            unique_vals = non_null.unique().tolist()
            metadata[col] = {
                'type': 'categorical',
                'codes': [{'code': v, 'label': str(v)} for v in unique_vals]
            }
    return metadata


def load_mdd(path):
    from core.mdd_parser import parse_mdd
    return parse_mdd(path)


def merge_multiple_response(df, source_columns, name):
    """Merge dichotomous (0/1) columns into a single semicolon-delimited multiple-response variable.

    Args:
        df: pandas DataFrame
        source_columns: list of column names in order (index 0 → code "1", index 1 → code "2", ...)
        name: name for the new merged column

    Returns:
        pandas Series with semicolon-delimited codes (e.g. "1;3;5") or empty string if none selected.
    """
    result = pd.Series(index=df.index, dtype=object)
    for idx in df.index:
        selected = []
        for i, col in enumerate(source_columns):
            val = str(df.at[idx, col]).strip()
            if val == '1':
                selected.append(str(i + 1))
        result.iloc[idx] = ';'.join(selected) if selected else ''

    return result

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

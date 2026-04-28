import json
import os
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

        try:
            numeric_vals = pd.to_numeric(non_null, errors='coerce')
            if numeric_vals.isna().sum() == 0:
                unique_vals = sorted(numeric_vals.unique().tolist())

                # Detect boolean (only 0 and/or 1)
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
                else:
                    metadata[col] = {
                        'type': 'numeric',
                        'answer_type': 'single_answer',
                        'codes': unique_vals,
                        'response_count': len(non_null),
                        'base_count': base_count,
                        'is_valid': len(non_null) == base_count
                    }
            else:
                # Check for semicolon-delimited multiple response
                has_semicolon = non_null.astype(str).str.contains(';', regex=False).any()

                if has_semicolon:
                    # Auto-extract individual codes from semicolon-delimited values
                    all_codes = set()
                    response_count = 0

                    for val in non_null:
                        codes = [c.strip() for c in str(val).split(';') if c.strip()]
                        all_codes.update(codes)
                        response_count += len(codes)

                    metadata[col] = {
                        'type': 'categorical',
                        'answer_type': 'multiple_answer',
                        'codes': [{'code': c, 'label': c} for c in sorted(all_codes)],
                        'response_count': response_count,
                        'base_count': base_count,
                        'is_valid': True  # Multiple answer is always valid
                    }
                else:
                    unique_vals = sorted(non_null.unique().tolist(), key=lambda x: (int(x) if str(x).isdigit() else float('inf'), str(x)))
                    metadata[col] = {
                        'type': 'categorical',
                        'answer_type': 'single_answer',
                        'codes': [{'code': v, 'label': str(v)} for v in unique_vals],
                        'response_count': len(non_null),
                        'base_count': base_count,
                        'is_valid': len(non_null) == base_count
                    }
        except Exception:
            # Check for semicolon-delimited multiple response even in exception case
            has_semicolon = non_null.astype(str).str.contains(';', regex=False).any()

            if has_semicolon:
                all_codes = set()
                response_count = 0

                for val in non_null:
                    codes = [c.strip() for c in str(val).split(';') if c.strip()]
                    all_codes.update(codes)
                    response_count += len(codes)

                metadata[col] = {
                    'type': 'categorical',
                    'answer_type': 'multiple_answer',
                    'codes': [{'code': c, 'label': c} for c in sorted(all_codes)],
                    'response_count': response_count,
                    'base_count': base_count,
                    'is_valid': True
                }
            else:
                unique_vals = sorted(non_null.unique().tolist(), key=lambda x: (int(x) if str(x).isdigit() else float('inf'), str(x)))
                metadata[col] = {
                    'type': 'categorical',
                    'answer_type': 'single_answer',
                    'codes': [{'code': v, 'label': str(v)} for v in unique_vals],
                    'response_count': len(non_null),
                    'base_count': base_count,
                    'is_valid': len(non_null) == base_count
                }
    return metadata


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


def merge_spread_columns(df, source_columns, name):
    """Merge spread/delimited columns into a single semicolon-delimited multiple-response variable.

    Args:
        df: pandas DataFrame
        source_columns: list of column names (e.g. Q1_1, Q1_2, Q1_3, ...)
        name: name for the new merged column

    Returns:
        pandas Series with semicolon-delimited codes (e.g. "1;2;3;4") or empty string if none selected.
    """
    result = pd.Series(index=df.index, dtype=object)
    for idx in df.index:
        selected = []
        for col in source_columns:
            val = str(df.at[idx, col]).strip()
            if val and val.lower() not in ('', 'nan', 'null', 'none'):
                selected.append(val)
        result.iloc[idx] = ';'.join(selected) if selected else ''

    return result


def merge_codes_or_and(df, source_variables, result_name, operator):
    """Merge multiple MA variables using OR or AND per code position.

    All source variables must have the same number of codes (columns).
    Each code position X is computed as: TOM/X OR Spont/X OR Aided/X (or AND).

    Args:
        df: pandas DataFrame
        source_variables: list of variable names (e.g. ["TOM", "Spont", "Aided"])
                          All must have same number of code-columns.
        result_name: name for the new merged column
        operator: "OR" or "AND"

    Returns:
        pandas Series with semicolon-delimited merged codes (e.g. "1;2;3;5").

    Raises:
        ValueError: if variables have incompatible code counts.
    """
    if len(source_variables) < 2:
        raise ValueError("At least 2 variables required for code merge.")

    first_var = source_variables[0]
    if first_var not in df.columns:
        raise ValueError(f"Variable '{first_var}' not found in data.")

    n_codes = len(df.columns)
    source_code_cols = [col for col in df.columns if col.startswith(first_var + "_")]
    if not source_code_cols:
        raise ValueError(f"Variable '{first_var}' does not look like an MA variable (no _code columns found).")

    n_codes = len(source_code_cols)
    for var in source_variables[1:]:
        var_cols = [col for col in df.columns if col.startswith(var + "_")]
        if len(var_cols) != n_codes:
            raise ValueError(
                f"Variable '{var}' has {len(var_cols)} codes but '{first_var}' has {n_codes}. "
                "All variables must have the same number of codes."
            )

    result = pd.Series(index=df.index, dtype=object)
    code_sep = ";"

    for idx in df.index:
        selected = []
        for code_pos in range(1, n_codes + 1):
            code_str = str(code_pos)
            vals = []
            for var in source_variables:
                col_name = f"{var}_{code_pos}"
                val = str(df.at[idx, col_name]).strip() if col_name in df.columns else "0"
                vals.append(val)

            if operator == "OR":
                if any(v == "1" for v in vals):
                    selected.append(code_str)
            elif operator == "AND":
                if all(v == "1" for v in vals):
                    selected.append(code_str)

        result.iloc[idx] = code_sep.join(selected) if selected else ""

    return result

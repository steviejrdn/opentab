import pandas as pd
import re


def parse_code_def(code_def, df):
    code_def = code_def.strip()
    errors = validate_code_def(code_def, df)
    if errors:
        raise ValueError(f"Invalid code definition '{code_def}': {'; '.join(errors)}")

    return _parse_or_expression(code_def, df)


def _parse_or_expression(expression, df):
    parts = _split_by_operator(expression, '+')
    if len(parts) == 1:
        return _parse_and_expression(expression, df)

    masks = [_parse_and_expression(part.strip(), df) for part in parts]
    result = masks[0]
    for mask in masks[1:]:
        result = result | mask
    return result


def _parse_and_expression(expression, df):
    parts = _split_by_operator(expression, '.')
    if len(parts) == 1:
        return _parse_atomic_unit(expression.strip(), df)

    masks = [_parse_atomic_unit(part.strip(), df) for part in parts]
    result = masks[0]
    for mask in masks[1:]:
        result = result & mask
    return result


def _split_by_operator(expression, operator):
    result = []
    current = ''
    i = 0
    while i < len(expression):
        if operator == '.' and expression[i] == '.' and i + 1 < len(expression) and expression[i+1] == '.':
            current += '..'
            i += 2
            continue

        if expression[i] == operator:
            if current.strip():
                result.append(current.strip())
            current = ''
        else:
            current += expression[i]
        i += 1
    if current.strip():
        result.append(current.strip())
    return result


def _parse_atomic_unit(unit, df):
    negate = unit.startswith('!')
    if negate:
        unit = unit[1:]

    match = re.match(r'^([A-Za-z0-9_]+)\s*/\s*(.+)$', unit)
    if not match:
        raise ValueError(f"Invalid atomic unit: '{unit}'. Expected format: variable/code")

    var_name = match.group(1)
    code_part = match.group(2).strip()

    if var_name not in df.columns:
        raise ValueError(f"Variable '{var_name}' not found in data")

    if code_part == '*':
        mask = df[var_name].notna() & (df[var_name].astype(str).str.strip() != '') & (df[var_name].astype(str) != 'nan')
        return ~mask if negate else mask

    range_match = re.match(r'^(\d+)\s*\.\.\s*(\d+)$', code_part)
    if range_match:
        start_code = range_match.group(1)
        end_code = range_match.group(2)
        range_codes = set(str(c) for c in range(int(start_code), int(end_code) + 1))
        col_str = df[var_name].astype(str).str.strip()
        if col_str.str.contains(';', regex=False).any():
            mask = col_str.apply(lambda x: bool(range_codes & set(str(x).split(';'))) if pd.notna(x) and str(x) not in ('nan', 'NaN', '') else False)
        else:
            mask = col_str.isin(range_codes)
        return ~mask if negate else mask

    codes = [c.strip() for c in code_part.split(',')]
    col_str = df[var_name].astype(str).str.strip()
    if col_str.str.contains(';', regex=False).any():
        mask = col_str.apply(lambda x: any(c in str(x).split(';') for c in codes) if pd.notna(x) and str(x) not in ('nan', 'NaN', '') else False)
    else:
        mask = col_str.isin(codes)
    return ~mask if negate else mask


def evaluate_code_def(code_def, df):
    """Compute mask without code-existence validation (for trusted inputs on filtered data)."""
    return _parse_or_expression(code_def.strip(), df)


def validate_code_def(code_def, df):
    errors = []
    units = re.split(r'\+', code_def)
    expanded_units = []
    for unit in units:
        and_parts = re.split(r'(?<!\.)\.(?!\.)', unit)
        expanded_units.extend(and_parts)

    for unit in expanded_units:
        unit = unit.strip()
        if not unit:
            continue

        if unit.startswith('!'):
            unit = unit[1:]

        match = re.match(r'^([A-Za-z0-9_]+)\s*/\s*(.+)$', unit)
        if not match:
            errors.append(f"Invalid format: '{unit}'. Expected: variable/code")
            continue

        var_name = match.group(1)
        code_part = match.group(2).strip()

        if var_name not in df.columns:
            errors.append(f"Variable '{var_name}' not found in data")
            continue

        if code_part == '*':
            continue

        range_match = re.match(r'^(\d+)\s*\.\.\s*(\d+)$', code_part)
        if range_match:
            start_code = int(range_match.group(1))
            end_code = int(range_match.group(2))
            if start_code > end_code:
                errors.append(f"Invalid range in '{unit}': start > end")
            continue

        codes = [c.strip() for c in code_part.split(',')]
        col_values = df[var_name].dropna().astype(str).unique()
        has_semicolon = any(';' in v for v in col_values)
        if has_semicolon:
            all_codes = set()
            for v in col_values:
                all_codes.update(str(v).split(';'))
            for code in codes:
                if code not in all_codes:
                    # Skip validation error for missing codes - they just won't match anything
                    # This allows filters to reference codes that don't exist in the data
                    pass
        else:
            for code in codes:
                if code not in col_values:
                    # Skip validation error for missing codes - they just won't match anything
                    # This allows filters to reference codes that don't exist in the data
                    pass

    return errors

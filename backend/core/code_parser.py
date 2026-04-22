import pandas as pd
import re


def parse_code_def(code_def, df, name_to_key=None, net_registry=None, code_registry=None):
    code_def = code_def.strip()
    errors = validate_code_def(code_def, df, name_to_key, net_registry, code_registry)
    if errors:
        raise ValueError(f"Invalid code definition '{code_def}': {'; '.join(errors)}")

    return _parse_or_expression(code_def, df, name_to_key, net_registry, code_registry)


def _resolve_var_name(var_name, name_to_key):
    if name_to_key:
        if var_name in name_to_key:
            return name_to_key[var_name]
        for display_name, key in name_to_key.items():
            if key == var_name:
                return var_name
    return var_name


def _parse_or_expression(expression, df, name_to_key=None, net_registry=None, code_registry=None):
    parts = _split_by_operator(expression, '+')
    if len(parts) == 1:
        return _parse_and_expression(expression, df, name_to_key, net_registry, code_registry)

    masks = [_parse_and_expression(part.strip(), df, name_to_key, net_registry, code_registry) for part in parts]
    result = masks[0]
    for mask in masks[1:]:
        result = result | mask
    return result


def _parse_and_expression(expression, df, name_to_key=None, net_registry=None, code_registry=None):
    parts = _split_by_operator(expression, '.')
    if len(parts) == 1:
        return _parse_atomic_unit(expression.strip(), df, name_to_key, net_registry, code_registry)

    masks = [_parse_atomic_unit(part.strip(), df, name_to_key, net_registry, code_registry) for part in parts]
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


def _parse_atomic_unit(unit, df, name_to_key=None, net_registry=None, code_registry=None):
    negate = unit.startswith('!')
    if negate:
        unit = unit[1:]

    match = re.match(r'^([A-Za-z0-9_]+)\s*/\s*(.+)$', unit)
    if not match:
        raise ValueError(f"Invalid atomic unit: '{unit}'. Expected format: variable/code")

    var_name = match.group(1)
    code_part = match.group(2).strip()

    resolved_var_name = _resolve_var_name(var_name, name_to_key)

    # Check code_registry first (custom codes with syntax)
    if code_registry:
        code_key = f"{resolved_var_name}/{code_part}"
        if code_key in code_registry:
            code_def = code_registry[code_key]
            return _parse_or_expression(code_def['syntax'], df, name_to_key, net_registry, code_registry)

    # Check net_registry
    if net_registry and code_part in net_registry:
        net_def = net_registry[code_part]
        net_syntax = net_def['syntax']
        return _parse_or_expression(net_syntax, df, name_to_key, net_registry, code_registry)

    if resolved_var_name not in df.columns:
        raise ValueError(f"Variable '{resolved_var_name}' not found in data")

    if code_part == '*':
        mask = df[resolved_var_name].notna() & (df[resolved_var_name].astype(str).str.strip() != '') & (df[resolved_var_name].astype(str) != 'nan')
        return ~mask if negate else mask

    range_match = re.match(r'^(\d+)\s*\.\.\s*(\d+)$', code_part)
    if range_match:
        start_code = range_match.group(1)
        end_code = range_match.group(2)
        range_codes = set(str(c) for c in range(int(start_code), int(end_code) + 1))
        col_str = df[resolved_var_name].astype(str).str.strip()
        if col_str.str.contains(';', regex=False).any():
            mask = col_str.apply(lambda x: bool(range_codes & set(x.split(';'))))
        else:
            mask = col_str.isin(range_codes)
        return ~mask if negate else mask

    codes = [c.strip() for c in code_part.split(',')]
    col_str = df[resolved_var_name].astype(str).str.strip()
    if col_str.str.contains(';', regex=False).any():
        mask = col_str.apply(lambda x: any(c in x.split(';') for c in codes))
    else:
        mask = col_str.isin(codes)
    return ~mask if negate else mask


def evaluate_code_def(code_def, df, name_to_key=None, net_registry=None, code_registry=None):
    """Compute mask without code-existence validation (for trusted inputs on filtered data)."""
    return _parse_or_expression(code_def.strip(), df, name_to_key, net_registry, code_registry)


def validate_code_def(code_def, df, name_to_key=None, net_registry=None, code_registry=None):
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

        resolved_var_name = _resolve_var_name(var_name, name_to_key)

        # Check code_registry first (custom codes with syntax)
        if code_registry:
            code_key = f"{resolved_var_name}/{code_part}"
            if code_key in code_registry:
                continue

        if net_registry and code_part in net_registry:
            continue

        if resolved_var_name not in df.columns:
            errors.append(f"Variable '{resolved_var_name}' not found in data")
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
        col_values = df[resolved_var_name].dropna().astype(str).unique()
        has_semicolon = any(';' in v for v in col_values)
        if has_semicolon:
            all_codes = set()
            for v in col_values:
                all_codes.update(v.split(';'))
            for code in codes:
                if code not in all_codes:
                    errors.append(f"Code '{code}' not found in variable '{resolved_var_name}'")
        else:
            for code in codes:
                if code not in col_values:
                    errors.append(f"Code '{code}' not found in variable '{resolved_var_name}'")

    return errors

import json
import re


def parse_simple_mdd(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    variables = {}
    for var_name, var_def in data.get('variables', {}).items():
        variables[var_name] = {
            'label': var_def.get('label', var_name),
            'type': var_def.get('type', 'categorical'),
            'codes': var_def.get('codes', [])
        }

    return variables


def parse_spss_mdd(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    variables = {}
    var_pattern = re.compile(
        r'(\w+)\s*=\s*makevariable\((.*?)\)',
        re.IGNORECASE | re.DOTALL
    )

    level_pattern = re.compile(
        r'(\d+)\s*=\s*"([^"]*)"',
        re.IGNORECASE
    )

    for match in var_pattern.finditer(content):
        var_name = match.group(1)
        var_body = match.group(2)

        label_match = re.search(r'name\s*=\s*"([^"]*)"', var_body, re.IGNORECASE)
        label = label_match.group(1) if label_match else var_name

        codes = []
        level_match = re.search(r'levels\s*=\s*\{(.*?)\}', var_body, re.IGNORECASE | re.DOTALL)
        if level_match:
            for code_match in level_pattern.finditer(level_match.group(1)):
                codes.append({
                    'code': int(code_match.group(1)),
                    'label': code_match.group(2)
                })

        variables[var_name] = {
            'label': label,
            'type': 'categorical',
            'codes': codes
        }

    return variables


def parse_mdd(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read().strip()

    if content.startswith('{'):
        return parse_simple_mdd(path)
    else:
        return parse_spss_mdd(path)

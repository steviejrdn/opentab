import json
import re
import xml.etree.ElementTree as ET


# ─── JSON format ─────────────────────────────────────────────────────────────
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


# ─── SPSS-style text format ───────────────────────────────────────────────────
def parse_spss_mdd(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    variables = {}
    var_pattern = re.compile(r'(\w+)\s*=\s*makevariable\((.*?)\)', re.IGNORECASE | re.DOTALL)
    level_pattern = re.compile(r'(\d+)\s*=\s*"([^"]*)"', re.IGNORECASE)

    for match in var_pattern.finditer(content):
        var_name = match.group(1)
        var_body = match.group(2)
        label_match = re.search(r'name\s*=\s*"([^"]*)"', var_body, re.IGNORECASE)
        label = label_match.group(1) if label_match else var_name
        codes = []
        level_match = re.search(r'levels\s*=\s*\{(.*?)\}', var_body, re.IGNORECASE | re.DOTALL)
        if level_match:
            for code_match in level_pattern.finditer(level_match.group(1)):
                codes.append({'code': str(code_match.group(1)), 'label': code_match.group(2)})
        variables[var_name] = {'label': label, 'type': 'categorical', 'codes': codes}
    return variables


# ─── IBM Dimensions XML format ────────────────────────────────────────────────
def parse_xml_mdd(path):
    """
    Parse IBM SPSS Data Collection / Dimensions MDD files in XML format.
    Handles multiple namespace variants and schema versions.
    """
    try:
        tree = ET.parse(path)
        root = tree.getroot()
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML in MDD file: {e}")

    # Strip namespace prefixes for easier matching
    def strip_ns(tag):
        return tag.split('}')[-1] if '}' in tag else tag

    variables = {}

    def get_label(elem):
        """Extract label text from Labels/Text child elements."""
        for child in elem:
            if strip_ns(child.tag) in ('Labels', 'labels'):
                for text_elem in child:
                    if strip_ns(text_elem.tag) in ('Text', 'text', 'label'):
                        txt = (text_elem.get('text') or text_elem.text or '').strip()
                        if txt:
                            return txt
        # Fallback: direct label attribute
        return elem.get('label') or elem.get('Label') or ''

    def parse_categories(elem):
        codes = []
        for child in elem:
            tag = strip_ns(child.tag)
            if tag in ('Categories', 'categories'):
                for cat in child:
                    cat_tag = strip_ns(cat.tag)
                    if cat_tag in ('Category', 'category'):
                        code = cat.get('name') or cat.get('Name') or cat.get('code') or ''
                        label = (cat.get('label') or cat.get('Label') or get_label(cat) or code).strip()
                        if code:
                            codes.append({'code': str(code), 'label': label})
        return codes

    def walk_fields(elem):
        tag = strip_ns(elem.tag)
        if tag in ('Field', 'field', 'Variable', 'variable'):
            name = elem.get('name') or elem.get('Name') or elem.get('id') or ''
            if not name:
                return
            label = (elem.get('label') or elem.get('Label') or get_label(elem) or name).strip()
            ftype_raw = (elem.get('type') or elem.get('Type') or elem.get('dataType') or 'categorical').lower()
            ftype = 'categorical' if 'cat' in ftype_raw or 'nominal' in ftype_raw or 'ordinal' in ftype_raw else \
                    'numeric' if 'num' in ftype_raw or 'long' in ftype_raw or 'double' in ftype_raw or 'float' in ftype_raw else \
                    'text' if 'text' in ftype_raw or 'string' in ftype_raw or 'char' in ftype_raw else 'categorical'
            codes = parse_categories(elem)
            variables[name] = {'label': label, 'type': ftype, 'codes': codes}

        for child in elem:
            walk_fields(child)

    walk_fields(root)

    if not variables:
        raise ValueError("No variables found in XML MDD. Unsupported schema.")

    return variables


# ─── Dispatcher ───────────────────────────────────────────────────────────────
def parse_mdd(path):
    """
    Auto-detect MDD format and parse:
    - JSON object  → parse_simple_mdd
    - XML document → parse_xml_mdd
    - SPSS text    → parse_spss_mdd
    """
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        head = f.read(512).lstrip()

    if head.startswith('{'):
        return parse_simple_mdd(path)
    if head.startswith('<') or head.startswith('<?xml') or head.lower().startswith('<?xml'):
        return parse_xml_mdd(path)
    return parse_spss_mdd(path)

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_loader import load_csv, load_mdd
from core.code_parser import parse_code_def, validate_code_def
from core.tabulator import create_crosstab, calculate_base
from core.statistics import calculate_frequencies, format_table_for_html

print("=" * 60)
print("TABULATOR - Phase 1 Test")
print("=" * 60)

print("\n[1] Loading CSV...")
df, metadata = load_csv('sample_data/sample.csv')
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
print(f"Columns: {list(df.columns)}")
print(f"Metadata: {metadata}")

print("\n[2] Loading MDD...")
mdd = load_mdd('sample_data/sample.mdd')
print(f"Loaded {len(mdd)} variables from MDD")
for var_name, var_def in mdd.items():
    print(f"  {var_name}: {var_def['label']} ({len(var_def['codes'])} codes)")

print("\n[3] Testing code parser...")
test_cases = [
    'Q1/1',
    'Q1/1+Q2/2',
    'Q1/1.Q2/2',
    'Q1/1..3',
    'Q1/1+Q2/2.Q3/1..3',
]

for tc in test_cases:
    try:
        mask = parse_code_def(tc, df)
        count = mask.sum()
        print(f"  '{tc}' -> {count} respondents")
    except Exception as e:
        print(f"  '{tc}' -> ERROR: {e}")

print("\n[4] Testing validation...")
errors = validate_code_def('Q99/1', df)
print(f"  'Q99/1' errors: {errors}")

print("\n[5] Testing crosstab...")
row_defs = [
    {'name': 'Q1=Aware', 'code_def': 'Q1/1'},
    {'name': 'Q1=Heard of', 'code_def': 'Q1/2'},
    {'name': 'Q1=Not aware', 'code_def': 'Q1/3'},
    {'name': 'Total', 'code_def': 'Q1/1..3'},
]

col_defs = [
    {'name': 'Male', 'code_def': 'Gender/M'},
    {'name': 'Female', 'code_def': 'Gender/F'},
    {'name': 'Total', 'code_def': 'Gender/M+Gender/F'},
]

crosstab = create_crosstab(df, row_defs, col_defs)
print("\nCrosstab (counts):")
print(crosstab)

print("\n[6] Testing statistics...")
stats = calculate_frequencies(crosstab)
print("\nRow %:")
print(stats['row_pct'])
print("\nCol %:")
print(stats['col_pct'])

print("\n[7] Testing HTML output...")
html = format_table_for_html(stats, show_counts=True, show_row_pct=True, show_col_pct=True)
print("\nHTML Table:")
print(html)

print("\n[8] Testing base calculation...")
base = calculate_base(df)
print(f"Total base: {base}")
base_filtered = calculate_base(df, 'Q1/1')
print(f"Base (Q1=1): {base_filtered}")

print("\n" + "=" * 60)
print("Phase 1 Test Complete!")
print("=" * 60)

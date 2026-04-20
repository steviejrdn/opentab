import pandas as pd
from core.code_parser import parse_code_def, evaluate_code_def


def create_crosstab(df, row_defs, col_defs, weight_col=None, filter_def=None):
    if filter_def:
        filter_mask = parse_code_def(filter_def, df)
        df = df[filter_mask]

    row_masks = []
    for i, row_def in enumerate(row_defs):
        name = row_def.get('label', row_def['name'])
        code_def = row_def['code_def']
        mask = evaluate_code_def(code_def, df)
        row_masks.append((name, mask))

    col_masks = []
    for i, col_def in enumerate(col_defs):
        name = col_def.get('label', col_def['name'])
        code_def = col_def['code_def']
        mask = evaluate_code_def(code_def, df)
        col_masks.append((name, mask))

    # Build crosstab matrix
    # Rows are row_masks, columns are col_masks
    data = []
    row_names = []
    for row_name, row_mask in row_masks:
        row_data = []
        for col_name, col_mask in col_masks:
            intersection = row_mask & col_mask
            if weight_col and weight_col in df.columns:
                count = df.loc[intersection, weight_col].astype(float).sum()
            else:
                count = intersection.sum()
            row_data.append(count)
        
        # Row total
        if weight_col and weight_col in df.columns:
            row_total = df.loc[row_mask, weight_col].astype(float).sum()
        else:
            row_total = row_mask.sum()
        row_data.append(row_total)
        
        data.append(row_data)
        row_names.append(row_name)
    
    # Column names (include Total)
    col_names = [name for name, _ in col_masks] + ['Total']
    
    # Create DataFrame
    crosstab_df = pd.DataFrame(data, index=row_names, columns=col_names)
    
    # Add Total row (Base)
    total_row = []
    for col_name, col_mask in col_masks:
        if weight_col and weight_col in df.columns:
            total_row.append(df.loc[col_mask, weight_col].astype(float).sum())
        else:
            total_row.append(col_mask.sum())
    
    # Grand total
    if weight_col and weight_col in df.columns:
        total_row.append(df[weight_col].astype(float).sum())
    else:
        total_row.append(len(df))
    
    crosstab_df.loc['Total'] = total_row

    return crosstab_df


def build_mask(code_def, df):
    return parse_code_def(code_def, df)


def calculate_base(df, filter_def=None):
    if filter_def:
        mask = parse_code_def(filter_def, df)
        return mask.sum()
    return len(df)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.tabulator import create_crosstab, calculate_base
from core.statistics import calculate_frequencies
from api.data import data_store

router = APIRouter()


class CrosstabItem(BaseModel):
    variable: str
    codeDef: str


class MeanScoreMapping(BaseModel):
    variable: str
    codeScores: dict[str, float]


class CrosstabRequest(BaseModel):
    row_items: list[CrosstabItem]
    col_items: list[CrosstabItem] = []
    filter_def: Optional[str] = None
    weight_col: Optional[str] = None
    mean_score_mappings: Optional[list[MeanScoreMapping]] = None


class CrosstabResponse(BaseModel):
    counts: dict
    row_pct: dict
    col_pct: dict
    total_pct: dict
    base: int
    mean: Optional[dict] = None
    std_error: Optional[dict] = None
    std_dev: Optional[dict] = None
    variance: Optional[dict] = None


def _compute_stats_for_column(df, col_mask, weight_col=None):
    if col_mask.sum() == 0:
        return {'mean': 0, 'std_error': 0, 'std_dev': 0, 'variance': 0}

    values = df.loc[col_mask, '_computed_score'].astype(float)
    valid = values.dropna()

    if len(valid) == 0:
        return {'mean': 0, 'std_error': 0, 'std_dev': 0, 'variance': 0}

    if weight_col and weight_col in df.columns:
        weights = df.loc[col_mask, weight_col].astype(float)
        valid_mask = df.loc[col_mask, '_computed_score'].notna()
        weights = weights[valid_mask]
        total_w = weights.sum()
        if total_w == 0:
            return {'mean': 0, 'std_error': 0, 'std_dev': 0, 'variance': 0}
        mean_val = (valid * weights).sum() / total_w
        variance = (weights * (valid - mean_val) ** 2).sum() / total_w
        n = len(valid)
    else:
        mean_val = valid.mean()
        variance = valid.var(ddof=1) if len(valid) > 1 else 0
        n = len(valid)

    std_dev = np.sqrt(variance) if variance > 0 else 0
    std_error = std_dev / np.sqrt(n) if n > 1 else 0

    return {
        'mean': round(mean_val, 2),
        'std_error': round(std_error, 2),
        'std_dev': round(std_dev, 2),
        'variance': round(variance, 2),
    }


@router.post("/crosstab", response_model=CrosstabResponse)
async def compute_crosstab(request: CrosstabRequest):
    df = data_store.get('df')
    if df is None:
        raise HTTPException(status_code=400, detail="No data loaded")

    if not request.row_items:
        raise HTTPException(status_code=400, detail="Row definitions are required")

    try:
        row_defs = []
        for item in request.row_items:
            if '/' in item.codeDef:
                var_part, codes_part = item.codeDef.split('/', 1)
                codes = codes_part.split(',')
            else:
                codes = item.codeDef.split(',')
                var_part = item.variable

            for code in codes:
                code_clean = code.strip()
                code_def = f"{var_part}/{code_clean}"
                row_defs.append({'name': item.variable, 'label': code_def, 'code_def': code_def})

        col_defs = []
        for item in request.col_items:
            if '/' in item.codeDef:
                var_part, codes_part = item.codeDef.split('/', 1)
                codes = codes_part.split(',')
            else:
                codes = item.codeDef.split(',')
                var_part = item.variable

            for code in codes:
                code_clean = code.strip()
                code_def = f"{var_part}/{code_clean}"
                col_defs.append({'name': item.variable, 'label': code_def, 'code_def': code_def})

        crosstab = create_crosstab(df, row_defs, col_defs, request.weight_col, request.filter_def)
        stats = calculate_frequencies(crosstab)
        base = calculate_base(df, request.filter_def)

        mean_data = None
        std_error_data = None
        std_dev_data = None
        variance_data = None

        if request.mean_score_mappings:
            score_map = {}
            for m in request.mean_score_mappings:
                score_map[m.variable] = m.codeScores

            working_df = df.copy()
            if request.filter_def:
                from core.code_parser import parse_code_def
                filter_mask = parse_code_def(request.filter_def, working_df)
                working_df = working_df[filter_mask]

            working_df['_computed_score'] = None
            has_scores = False
            for var_name, codes in score_map.items():
                if var_name in working_df.columns:
                    for code, score in codes.items():
                        mask = working_df[var_name].astype(str) == str(code)
                        working_df.loc[mask, '_computed_score'] = score
                        has_scores = True

            if has_scores:
                col_names = [cd['label'] for cd in col_defs] + ['Total']

                col_masks = []
                for cd in col_defs:
                    from core.code_parser import evaluate_code_def
                    col_masks.append((cd['label'], evaluate_code_def(cd['code_def'], working_df)))

                all_mask = pd.Series([True] * len(working_df), index=working_df.index)

                mean_data = {}
                std_error_data = {}
                std_dev_data = {}
                variance_data = {}

                for col_name, col_mask in col_masks:
                    col_stats = _compute_stats_for_column(working_df, col_mask, request.weight_col)
                    mean_data[col_name] = col_stats['mean']
                    std_error_data[col_name] = col_stats['std_error']
                    std_dev_data[col_name] = col_stats['std_dev']
                    variance_data[col_name] = col_stats['variance']

                total_stats = _compute_stats_for_column(working_df, all_mask, request.weight_col)
                mean_data['Total'] = total_stats['mean']
                std_error_data['Total'] = total_stats['std_error']
                std_dev_data['Total'] = total_stats['std_dev']
                variance_data['Total'] = total_stats['variance']

        return CrosstabResponse(
            counts=stats['counts'].to_dict(orient='index'),
            row_pct=stats['row_pct'].round(1).to_dict(orient='index'),
            col_pct=stats['col_pct'].round(1).to_dict(orient='index'),
            total_pct=stats['total_pct'].round(1).to_dict(orient='index'),
            base=int(base),
            mean=mean_data,
            std_error=std_error_data,
            std_dev=std_dev_data,
            variance=variance_data,
        )
    except ValueError as e:
        print(f"ERROR ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"ERROR Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

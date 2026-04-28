from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import os
import io

_SAMPLE_DIR = Path(__file__).parent.parent / "sample_data"

from ..core.data_loader import load_csv, merge_multiple_response, merge_spread_columns, detect_column_types

router = APIRouter()

data_store = {
    'df': None,
    'metadata': {},
    'file_name': None,
    'merged_variables': {}
}


class UploadResponse(BaseModel):
    columns: list[str]
    row_count: int
    metadata: dict
    format: Optional[str] = None





class VariableInfo(BaseModel):
    name: str
    label: str
    type: str
    answer_type: str = 'single_answer'  # 'single_answer' | 'multiple_answer'
    codes: list[dict]
    response_count: int = 0
    base_count: int = 0
    is_valid: bool = True
    syntax: Optional[str] = None
    code_syntax: Optional[list[str]] = None
    is_custom: Optional[bool] = False


class VariablesResponse(BaseModel):
    variables: dict[str, VariableInfo]


class DataInfo(BaseModel):
    file_name: Optional[str]
    row_count: int
    column_count: int
    columns: list[str]


# ─── CSV upload ───────────────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Only CSV/TXT files are supported.")

    temp_path = os.path.join("temp", file.filename)
    os.makedirs("temp", exist_ok=True)

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        df, metadata = load_csv(temp_path)
        data_store['df'] = df
        data_store['metadata'] = metadata
        data_store['file_name'] = file.filename
        return UploadResponse(columns=list(df.columns), row_count=len(df), metadata=metadata, format='csv')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





# ─── Merge multiple response ──────────────────────────────────────────────────
class MergeMRRequest(BaseModel):
    name: str
    source_columns: list[str]
    label: Optional[str] = None

class MergeMRResponse(BaseModel):
    name: str
    label: str
    codes: list[dict]
    source_columns: list[str]

@router.post("/merge-mr", response_model=MergeMRResponse)
async def merge_mr(request: MergeMRRequest):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    df = data_store['df']

    for col in request.source_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{col}' not found in data.")

    if request.name in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable '{request.name}' already exists in data.")

    merged_series = merge_multiple_response(df, request.source_columns, request.name)
    data_store['df'][request.name] = merged_series

    codes = [{'code': str(i + 1), 'label': request.source_columns[i]} for i in range(len(request.source_columns))]
    label = request.label or request.name

    data_store['merged_variables'][request.name] = {
        'label': label,
        'type': 'multiple_response',
        'answer_type': 'multiple_answer',
        'codes': codes,
        'source_columns': request.source_columns,
    }

    return MergeMRResponse(name=request.name, label=label, codes=codes, source_columns=request.source_columns)

# ─── List merged variables ────────────────────────────────────────────────────
class MergedVariablesResponse(BaseModel):
    variables: dict[str, dict]

@router.get("/merged-variables", response_model=MergedVariablesResponse)
async def get_merged_variables():
    return MergedVariablesResponse(variables=data_store['merged_variables'])

# ─── Delete merged variable ───────────────────────────────────────────────────
@router.delete("/merge-mr/{name}")
async def delete_merged_variable(name: str):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    if name not in data_store['merged_variables']:
        raise HTTPException(status_code=404, detail=f"Merged variable '{name}' not found.")

    if name in data_store['df'].columns:
        data_store['df'] = data_store['df'].drop(columns=[name])
    del data_store['merged_variables'][name]
    return {"status": "ok"}


# ─── Merge Variables (MA Binary / Spread) ────────────────────────────────────
class MergeVariablesRequest(BaseModel):
    columns: list[str]
    new_variable_name: str
    merge_type: str  # "binary" or "spread"
    code_prefix: Optional[str] = None


class MergeVariablesResponse(BaseModel):
    name: str
    label: str
    type: str
    codes: list[dict]
    syntax: str
    code_syntax: list[str]
    is_custom: bool = True


@router.post("/merge_variables", response_model=MergeVariablesResponse)
async def merge_variables(request: MergeVariablesRequest):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    df = data_store['df']
    for col in request.columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{col}' not found in data.")

    if request.new_variable_name in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable '{request.new_variable_name}' already exists.")

    if request.merge_type not in ('binary', 'spread'):
        raise HTTPException(status_code=400, detail="merge_type must be 'binary' or 'spread'.")

    if request.merge_type == 'binary':
        merged_series = merge_multiple_response(df, request.columns, request.new_variable_name)
    else:
        merged_series = merge_spread_columns(df, request.columns, request.new_variable_name)

    data_store['df'][request.new_variable_name] = merged_series

    prefix = request.code_prefix or ""
    codes = []
    for i, col in enumerate(request.columns):
        code_val = f"{prefix}{i+1}" if prefix else str(i + 1)
        codes.append({'code': code_val, 'label': col})

    label = request.new_variable_name
    code_syntax = [f"${col}/1" for col in request.columns]

    data_store['merged_variables'][request.new_variable_name] = {
        'label': label,
        'type': 'multiple_response',
        'answer_type': 'multiple_answer',
        'codes': codes,
        'syntax': ",".join(code_syntax),
        'code_syntax': code_syntax,
        'source_columns': request.columns,
    }

    return MergeVariablesResponse(name=request.new_variable_name, label=label, type='multiple_response', codes=codes, syntax=",".join(code_syntax), code_syntax=code_syntax, is_custom=True)


# ─── Merge Codes (OR / AND) ──────────────────────────────────────────────────
class MergeCodesRequest(BaseModel):
    variables: list[str]
    new_variable_name: str
    merge_operator: str  # "OR" or "AND"
    description: Optional[str] = None


class MergeCodesResponse(BaseModel):
    name: str
    label: str
    type: str
    codes: list[dict]
    syntax: str
    code_syntax: list[str]
    merge_operator: str
    is_custom: bool = True


@router.post("/merge_codes", response_model=MergeCodesResponse)
async def merge_codes(request: MergeCodesRequest):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    if len(request.variables) < 2:
        raise HTTPException(status_code=400, detail="At least 2 variables required.")

    if request.merge_operator not in ('OR', 'AND'):
        raise HTTPException(status_code=400, detail="merge_operator must be 'OR' or 'AND'.")

    df = data_store['df']
    for var in request.variables:
        if var not in df.columns:
            raise HTTPException(status_code=400, detail=f"Variable '{var}' not found in data.")

    first_var = request.variables[0]
    first_cols = [c for c in df.columns if c.startswith(first_var + "_")]
    n_codes = len(first_cols)

    if n_codes == 0:
        raise HTTPException(status_code=400, detail=f"Variable '{first_var}' does not appear to be an MA variable (no _code columns found).")

    for var in request.variables[1:]:
        var_cols = [c for c in df.columns if c.startswith(var + "_")]
        if len(var_cols) != n_codes:
            raise HTTPException(
                status_code=400,
                detail=f"Variable '{var}' has {len(var_cols)} codes but '{first_var}' has {n_codes}. "
                       "All variables must have the same number of codes."
            )

    if request.new_variable_name in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable '{request.new_variable_name}' already exists.")

    result = pd.Series(index=df.index, dtype=object)
    sep = "+" if request.merge_operator == "OR" else "."

    for idx in df.index:
        selected = []
        for code_pos in range(1, n_codes + 1):
            code_str = str(code_pos)
            vals = []
            for var in request.variables:
                col_name = f"{var}_{code_pos}"
                val = "0"
                if col_name in df.columns:
                    val = str(df.at[idx, col_name]).strip()
                vals.append(val)

            if request.merge_operator == "OR":
                if any(v == "1" for v in vals):
                    selected.append(code_str)
            else:
                if all(v == "1" for v in vals):
                    selected.append(code_str)

        result.iloc[idx] = ";".join(selected) if selected else ""

    data_store['df'][request.new_variable_name] = result

    codes = [{'code': str(i + 1), 'label': f"Code {i + 1}"} for i in range(n_codes)]
    label = request.description or request.new_variable_name
    sep = "+" if request.merge_operator == "OR" else "."
    code_syntax = [
        sep.join(f"${var}/{code_pos}" for var in request.variables)
        for code_pos in range(1, n_codes + 1)
    ]
    syntax = ",".join(code_syntax)

    data_store['merged_variables'][request.new_variable_name] = {
        'label': label,
        'type': 'code_merge',
        'answer_type': 'multiple_answer',
        'codes': codes,
        'syntax': syntax,
        'code_syntax': code_syntax,
        'merge_operator': request.merge_operator,
        'source_variables': request.variables,
    }

    return MergeCodesResponse(
        name=request.new_variable_name,
        label=label,
        type='code_merge',
        codes=codes,
        syntax=syntax,
        code_syntax=code_syntax,
        merge_operator=request.merge_operator,
        is_custom=True
    )

# ─── Sample data ──────────────────────────────────────────────────────────────
@router.post("/load-sample")
async def load_sample():
    sample_csv = str(_SAMPLE_DIR / "sample.csv")

    if not os.path.exists(sample_csv):
        raise HTTPException(status_code=404, detail="Sample data not found.")

    try:
        df, metadata = load_csv(sample_csv)
        data_store['df'] = df
        data_store['metadata'] = metadata
        data_store['file_name'] = 'sample.csv'

        return {"columns": list(df.columns), "row_count": len(df), "metadata": metadata}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Variables ────────────────────────────────────────────────────────────────
@router.get("/variables", response_model=VariablesResponse)
async def get_variables():
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    df = data_store['df']
    metadata = data_store['metadata']

    variables = {}
    base_count = len(df)

    for col in df.columns:
        if col in data_store['merged_variables']:
            merged = data_store['merged_variables'][col]
            # Calculate response count for merged variable
            response_count = 0
            if col in df.columns:
                for val in df[col].dropna():
                    if val:
                        response_count += len(str(val).split(';'))

            variables[col] = VariableInfo(
                name=col,
                label=merged['label'],
                type='multiple_response',
                answer_type='multiple_answer',
                codes=merged['codes'],
                response_count=response_count,
                base_count=base_count,
                is_valid=True,
                is_custom=True
            )
            continue

        codes = metadata.get(col, {}).get('codes', [])
        # Sort codes if they are dicts with 'code' key
        if codes and isinstance(codes[0], dict) and 'code' in codes[0]:
            codes = sorted(codes, key=lambda x: (int(x['code']) if str(x['code']).isdigit() else float('inf'), str(x['code'])))
        label = metadata.get(col, {}).get('label', col)
        var_type = metadata.get(col, {}).get('type', 'categorical')
        answer_type = metadata.get(col, {}).get('answer_type', 'single_answer')
        response_count = metadata.get(col, {}).get('response_count', len(df[col].dropna()))
        is_valid = metadata.get(col, {}).get('is_valid', True)

        normalized_codes = []
        for c in codes:
            if isinstance(c, dict):
                normalized_codes.append({
                    'code': str(c.get('code', '')),
                    'label': c.get('label', str(c.get('code', '')))
                })
            else:
                normalized_codes.append({'code': str(c), 'label': str(c)})

        if not normalized_codes:
            unique_vals = sorted(df[col].dropna().unique().tolist(), key=lambda x: (int(x) if str(x).isdigit() else float('inf'), str(x)))
            normalized_codes = [{'code': str(v), 'label': str(v)} for v in unique_vals]

        # Sort normalized_codes by code value
        normalized_codes = sorted(normalized_codes, key=lambda x: (int(x['code']) if str(x['code']).isdigit() else float('inf'), str(x['code'])))

        variables[col] = VariableInfo(
            name=col,
            label=label,
            type=var_type,
            answer_type=answer_type,
            codes=normalized_codes,
            response_count=response_count,
            base_count=base_count,
            is_valid=is_valid
        )

    return VariablesResponse(variables=variables)


# ─── Info ─────────────────────────────────────────────────────────────────────
@router.get("/info", response_model=DataInfo)
async def get_data_info():
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    df = data_store['df']
    return DataInfo(
        file_name=data_store['file_name'],
        row_count=len(df),
        column_count=len(df.columns),
        columns=list(df.columns)
    )


# ─── Raw CSV export ───────────────────────────────────────────────────────────
@router.get("/raw")
async def get_raw_csv():
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")
    csv_text = data_store['df'].to_csv(index=False)
    return Response(content=csv_text, media_type="text/csv")


# ─── Upload from text (session restore) ──────────────────────────────────────
class UploadTextRequest(BaseModel):
    csv_text: str
    file_name: Optional[str] = "restored.csv"

@router.post("/upload-text", response_model=UploadResponse)
async def upload_text(request: UploadTextRequest):
    try:
        import pandas as pd
        df = pd.read_csv(io.StringIO(request.csv_text), dtype=str)
        metadata = detect_column_types(df)
        data_store['df'] = df
        data_store['metadata'] = metadata
        data_store['file_name'] = request.file_name
        data_store['merged_variables'] = {}
        return UploadResponse(columns=list(df.columns), row_count=len(df), metadata=metadata, format='csv')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Register merged variable metadata (column already exists in df) ─────────
class RegisterMergedRequest(BaseModel):
    name: str
    metadata: dict

@router.post("/register-merged")
async def register_merged(request: RegisterMergedRequest):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")
    if request.name not in data_store['df'].columns:
        raise HTTPException(status_code=400, detail=f"Column '{request.name}' not found in data.")
    data_store['merged_variables'][request.name] = request.metadata
    return {"status": "ok", "name": request.name}


# ─── Register net code metadata ──────────────────────────────────────────────
class RegisterNetRequest(BaseModel):
    code: str
    variable: str
    label: str
    netOf: list[str]
    syntax: str

@router.post("/register-net")
async def register_net(request: RegisterNetRequest):
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")
    # Store net code metadata in data_store
    if 'net_registry' not in data_store:
        data_store['net_registry'] = {}
    data_store['net_registry'][request.code] = {
        'variable': request.variable,
        'label': request.label,
        'netOf': request.netOf,
        'syntax': request.syntax
    }
    return {"status": "ok", "code": request.code}


@router.get("/net-registry")
async def get_net_registry():
    """Get the net code registry and name-to-key mapping."""
    net_registry = data_store.get('net_registry', {})
    # Build name_to_key mapping from current variables
    name_to_key = {}
    if data_store['df'] is not None:
        for col in data_store['df'].columns:
            # Use column name as both key and display name
            name_to_key[col] = col
    return {
        "net_registry": net_registry,
        "name_to_key": name_to_key
    }

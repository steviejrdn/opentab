from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from pydantic import BaseModel
from typing import Optional
import os
import sys
import zipfile
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.data_loader import load_csv, merge_multiple_response, merge_spread_columns, detect_column_types
from core.mdd_parser import parse_mdd

router = APIRouter()

data_store = {
    'df': None,
    'metadata': {},
    'mdd': {},
    'file_name': None,
    'merged_variables': {}
}


class UploadResponse(BaseModel):
    columns: list[str]
    row_count: int
    metadata: dict
    format: Optional[str] = None


class ZipUploadResponse(BaseModel):
    columns: list[str]
    row_count: int
    metadata: dict
    format: str
    files_found: list[str]


class VariableInfo(BaseModel):
    name: str
    label: str
    type: str
    codes: list[dict]
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


# ─── MDD-only upload (metadata) ───────────────────────────────────────────────
@router.post("/upload-mdd")
async def upload_mdd_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.mdd'):
        raise HTTPException(status_code=400, detail="Only MDD files are supported here.")

    temp_path = os.path.join("temp", file.filename)
    os.makedirs("temp", exist_ok=True)

    content = await file.read()
    if b'\x00' in content[:4096]:
        raise HTTPException(
            status_code=400,
            detail="This MDD file is in binary (compiled) format. Please use the text/XML export from IBM Dimensions."
        )

    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        mdd = parse_mdd(temp_path)
        data_store['mdd'] = mdd
        return {"variable_count": len(mdd), "variables": list(mdd.keys())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse MDD: {str(e)}")


# ─── CSV + MDD paired upload ──────────────────────────────────────────────────
@router.post("/upload-pair", response_model=UploadResponse)
async def upload_pair(
    csv_file: UploadFile = File(...),
    mdd_file: UploadFile = File(...)
):
    if not csv_file.filename.lower().endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="csv_file must be a CSV file.")
    if not mdd_file.filename.lower().endswith('.mdd'):
        raise HTTPException(status_code=400, detail="mdd_file must be an MDD file.")

    os.makedirs("temp", exist_ok=True)
    csv_path = os.path.join("temp", csv_file.filename)
    mdd_path = os.path.join("temp", mdd_file.filename)

    with open(csv_path, "wb") as f:
        f.write(await csv_file.read())
    with open(mdd_path, "wb") as f:
        f.write(await mdd_file.read())

    try:
        df, metadata = load_csv(csv_path)
        mdd = parse_mdd(mdd_path)
        data_store['df'] = df
        data_store['metadata'] = metadata
        data_store['mdd'] = mdd
        data_store['file_name'] = csv_file.filename
        return UploadResponse(columns=list(df.columns), row_count=len(df), metadata=metadata, format='csv+mdd')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── ZIP upload (CSV + MDD) ───────────────────────────────────────────────────
@router.post("/upload-zip", response_model=ZipUploadResponse)
async def upload_zip(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported here.")

    content = await file.read()
    os.makedirs("temp", exist_ok=True)

    try:
        zf_bytes = io.BytesIO(content)
        with zipfile.ZipFile(zf_bytes) as zf:
            names = [n for n in zf.namelist() if not n.endswith('/') and os.path.basename(n)]
            files_found = [os.path.basename(n) for n in names]

            extracted: dict[str, str] = {}
            for name in names:
                basename = os.path.basename(name)
                dest = os.path.join("temp", basename)
                with open(dest, "wb") as fh:
                    fh.write(zf.read(name))
                extracted[basename.lower()] = dest

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open ZIP: {e}")

    csv_paths = [p for k, p in extracted.items() if k.endswith(('.csv', '.txt'))]
    mdd_paths = [p for k, p in extracted.items() if k.endswith('.mdd')]

    df = None
    metadata = {}
    mdd = {}
    fmt = 'unknown'

    try:
        if csv_paths and mdd_paths:
            df, metadata = load_csv(csv_paths[0])
            mdd = parse_mdd(mdd_paths[0])
            fmt = 'csv+mdd'
        elif csv_paths:
            df, metadata = load_csv(csv_paths[0])
            fmt = 'csv'
        elif mdd_paths:
            mdd = parse_mdd(mdd_paths[0])
            data_store['mdd'] = mdd
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Only an MDD file was found in the ZIP ({files_found}). "
                    "Add the CSV data file to the ZIP and re-upload."
                )
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"No supported files found in ZIP. Contents: {files_found or ['(empty)']}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if df is None:
        raise HTTPException(status_code=500, detail="Failed to load data from ZIP.")

    data_store['df'] = df
    data_store['metadata'] = metadata
    data_store['mdd'] = mdd
    data_store['file_name'] = files_found[0] if files_found else file.filename

    return ZipUploadResponse(
        columns=list(df.columns),
        row_count=len(df),
        metadata=metadata,
        format=fmt,
        files_found=files_found
    )


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
    code_syntax = [f"{col}/1" for col in request.columns]

    data_store['merged_variables'][request.new_variable_name] = {
        'label': label,
        'type': request.merge_type,
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
        sep.join(f"{var}/{code_pos}" for var in request.variables)
        for code_pos in range(1, n_codes + 1)
    ]
    syntax = ",".join(code_syntax)

    data_store['merged_variables'][request.new_variable_name] = {
        'label': label,
        'type': 'code_merge',
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
    sample_csv = os.path.join("sample_data", "sample.csv")
    sample_mdd = os.path.join("sample_data", "sample.mdd")

    if not os.path.exists(sample_csv):
        raise HTTPException(status_code=404, detail="Sample data not found.")

    try:
        df, metadata = load_csv(sample_csv)
        data_store['df'] = df
        data_store['metadata'] = metadata
        data_store['file_name'] = 'sample.csv'

        if os.path.exists(sample_mdd):
            mdd = parse_mdd(sample_mdd)
            data_store['mdd'] = mdd

        return {"columns": list(df.columns), "row_count": len(df), "metadata": metadata}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Variables ────────────────────────────────────────────────────────────────
@router.get("/variables", response_model=VariablesResponse)
async def get_variables():
    if data_store['df'] is None:
        raise HTTPException(status_code=400, detail="No data loaded.")

    df = data_store['df']
    mdd = data_store['mdd']
    metadata = data_store['metadata']

    variables = {}
    for col in df.columns:
        if col in data_store['merged_variables']:
            merged = data_store['merged_variables'][col]
            variables[col] = VariableInfo(
                name=col, label=merged['label'], type='multiple_response',
                codes=merged['codes']
            )
            continue

        if col in mdd:
            mdd_var = mdd[col]
            codes = mdd_var.get('codes', [])
            label = mdd_var.get('label', col)
            var_type = mdd_var.get('type', 'categorical')
        else:
            codes = metadata.get(col, {}).get('codes', [])
            label = col
            var_type = metadata.get(col, {}).get('type', 'categorical')

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
            unique_vals = df[col].dropna().unique().tolist()
            normalized_codes = [{'code': str(v), 'label': str(v)} for v in unique_vals]

        variables[col] = VariableInfo(name=col, label=label, type=var_type, codes=normalized_codes)

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

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import sys
import zipfile
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.data_loader import load_csv
from core.mdd_parser import parse_mdd

router = APIRouter()

data_store = {
    'df': None,
    'metadata': {},
    'mdd': {},
    'file_name': None
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

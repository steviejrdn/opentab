from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()

tables_store = {}


class TableCreate(BaseModel):
    name: str


class TableUpdate(BaseModel):
    row_items: list[dict] = []
    col_items: list[dict] = []
    filter_items: list[dict] = []
    weight_col: Optional[str] = None
    filter_def: Optional[str] = None


class TableResponse(BaseModel):
    id: str
    name: str
    row_items: list[dict]
    col_items: list[dict]
    filter_items: list[dict]
    weight_col: Optional[str]
    filter_def: Optional[str]
    result: Optional[dict]


@router.get("/", response_model=list[TableResponse])
async def list_tables():
    return list(tables_store.values())


@router.post("/", response_model=TableResponse)
async def create_table(table: TableCreate):
    table_id = str(uuid.uuid4())[:8]
    new_table = {
        'id': table_id,
        'name': table.name,
        'row_items': [],
        'col_items': [],
        'filter_items': [],
        'weight_col': None,
        'filter_def': None,
        'result': None
    }
    tables_store[table_id] = new_table
    return TableResponse(**new_table)


@router.get("/{table_id}", response_model=TableResponse)
async def get_table(table_id: str):
    if table_id not in tables_store:
        raise HTTPException(status_code=404, detail="Table not found")
    return TableResponse(**tables_store[table_id])


@router.put("/{table_id}", response_model=TableResponse)
async def update_table(table_id: str, updates: TableUpdate):
    if table_id not in tables_store:
        raise HTTPException(status_code=404, detail="Table not found")

    table = tables_store[table_id]
    table['row_items'] = updates.row_items
    table['col_items'] = updates.col_items
    table['filter_items'] = updates.filter_items
    table['weight_col'] = updates.weight_col
    table['filter_def'] = updates.filter_def

    return TableResponse(**table)


@router.delete("/{table_id}")
async def delete_table(table_id: str):
    if table_id not in tables_store:
        raise HTTPException(status_code=404, detail="Table not found")

    del tables_store[table_id]
    return {"message": "Table deleted"}

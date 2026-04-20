#!/bin/bash
cd /c/Users/stvjr/Documents/tabulator/backend
uvicorn main:app --reload --port 8000 &

cd /c/Users/stvjr/Documents/tabulator/frontend
npm run dev
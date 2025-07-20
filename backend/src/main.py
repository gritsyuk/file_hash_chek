import hashlib
from fastapi import FastAPI, File, UploadFile, Form, Request, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os
from datetime import datetime
from typing import List
from fastapi.responses import JSONResponse

app = FastAPI()

# Настройка CORS
origins = [
    "http://localhost:3000",
    "http://akvilon.bridgelife.ru",
    "https://akvilon.bridgelife.ru",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "file_uploads.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        upload_time TEXT,
        hostname TEXT,
        file_hash TEXT
    )""")
    conn.commit()
    conn.close()


init_db()


@app.post("/hash")
async def get_file_hash(request: Request, files: List[UploadFile] = File(...)):
    """
    Принимает до 10 файлов и возвращает их хеши SHA-256. Также сохраняет информацию в SQLite.
    """
    results = []
    hostname = request.client.host if request.client else "unknown"
    upload_time = datetime.now().isoformat(sep=" ", timespec="seconds")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for file in files[:10]:
        sha256_hash = hashlib.sha256()
        for chunk in file.file:
            sha256_hash.update(chunk)
        file_hash = sha256_hash.hexdigest()
        filename = file.filename
        # Проверка на существование хэша
        c.execute("SELECT COUNT(*) FROM uploads WHERE file_hash = ?", (file_hash,))
        exists = c.fetchone()[0] > 0
        if not exists:
            c.execute(
                "INSERT INTO uploads (filename, upload_time, hostname, file_hash) VALUES (?, ?, ?, ?)",
                (filename, upload_time, hostname, file_hash),
            )
        results.append({"filename": filename, "hash": file_hash, "exists": exists})
    conn.commit()
    conn.close()
    return {"results": results}


@app.post("/verify")
async def verify_file_hash(file: UploadFile = File(...), hash: str = Form(...)):
    """
    Принимает файл и хеш, и проверяет их соответствие. Также ищет хеш в базе данных.
    """
    sha256_hash = hashlib.sha256()
    for chunk in file.file:
        sha256_hash.update(chunk)

    calculated_hash = sha256_hash.hexdigest()

    # Проверка наличия хеша в базе
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM uploads WHERE file_hash = ?", (calculated_hash,))
    found = c.fetchone()[0] > 0
    conn.close()

    if found:
        db_message = "Хеш найден в базе"
    else:
        db_message = "Хеш не найден в базе"

    if calculated_hash.lower() == hash.lower():
        return {"message": f"Хеш совпадает (проверено на сервере). {db_message}"}
    else:
        return {"message": f"Хеш не совпадает. {db_message}"}


@app.post("/verify-multi")
async def verify_multi(files: List[UploadFile] = File(...)):
    results = []
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for file in files[:10]:
        sha256_hash = hashlib.sha256()
        for chunk in file.file:
            sha256_hash.update(chunk)
        file_hash = sha256_hash.hexdigest()
        c.execute(
            "SELECT filename FROM uploads WHERE file_hash = ? LIMIT 1", (file_hash,)
        )
        row = c.fetchone()
        if row:
            results.append(
                {"filename": file.filename, "found": True, "db_filename": row[0]}
            )
        else:
            results.append({"filename": file.filename, "found": False})
    conn.close()
    return JSONResponse(content={"results": results})


@app.get("/uploads")
async def get_uploads(limit: int = Query(20, ge=1), offset: int = Query(0, ge=0)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """SELECT upload_time, filename, hostname, file_hash FROM uploads ORDER BY upload_time DESC LIMIT ? OFFSET ?""",
        (limit, offset),
    )
    rows = c.fetchall()
    conn.close()
    uploads = [
        {
            "upload_time": row[0],
            "filename": row[1],
            "hostname": row[2],
            "file_hash": row[3],
        }
        for row in rows
    ]
    return {"uploads": uploads}


@app.delete("/uploads/{file_hash}")
async def delete_upload(file_hash: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM uploads WHERE file_hash = ?", (file_hash,))
    deleted = c.rowcount
    conn.commit()
    conn.close()
    if deleted:
        return {"status": "success", "message": "Запись удалена"}
    else:
        raise HTTPException(status_code=404, detail="Запись не найдена")

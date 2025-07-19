import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

function App() {
  const [hashResult, setHashResult] = useState('');
  const [hashResultTimeout, setHashResultTimeout] = useState(null);
  const [verificationResult, setVerificationResult] = useState('');
  const [verificationTimeout, setVerificationTimeout] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Определяем базовый адрес API
  const API_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';

  // Загрузка данных из /uploads
  useEffect(() => {
    axios.get(`${API_URL}/uploads?limit=${rowsPerPage}&offset=${page * rowsPerPage}`)
      .then(res => setUploads(res.data.uploads))
      .catch(() => setUploads([]));
  }, [page, rowsPerPage, hashResult, verificationResult, API_URL]);

  // Обработчик для первой области (загрузка и получение хеша)
  const onDrop1 = useCallback(async (acceptedFiles) => {
    const files = acceptedFiles.slice(0, 10);
    if (files.length > 0) {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      try {
        const response = await axios.post(`${API_URL}/hash`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        if (Array.isArray(response.data.results)) {
          const msg = response.data.results.map(r =>
            r.exists
              ? `хеш для файла ${r.filename} уже существует в базе 🚫`
              : `успешно создан хеш для файла ${r.filename} ✅`
          ).join('\n');
          setHashResult(msg);
        } else {
          setHashResult('Ошибка при получении хеша');
        }
      } catch (error) {
        if (files.length === 1) {
          setHashResult(`ошибка создания или записи хэша в бд для файла ${files[0].name} 🚫`);
        } else {
          const msg = files.map(f => `ошибка создания или записи хэша в бд для файла ${f.name} 🚫`).join('\n');
          setHashResult(msg);
        }
      }
      // Очистить сообщение через 10 секунд
      if (hashResultTimeout) clearTimeout(hashResultTimeout);
      const timeout = setTimeout(() => setHashResult(''), 10000);
      setHashResultTimeout(timeout);
    }
  }, [hashResultTimeout]);

  // Обработчик для второй области (проверка хеша)
  const onDrop2 = useCallback(async (acceptedFiles) => {
    const files = acceptedFiles.slice(0, 10);
    if (files.length > 0) {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      try {
        const response = await axios.post(`${API_URL}/verify-multi`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        if (Array.isArray(response.data.results)) {
          const msg = response.data.results.map(r =>
            r.found
              ? `${r.filename} соответствует ${r.db_filename} ✅`
              : `<span class="verify-error">${r.filename} изменен или его изначальный хеш не загружен в БД 🚫</span>`
          ).join('<br/>');
          setVerificationResult(msg);
        } else {
          setVerificationResult('Ошибка при проверке файлов');
        }
      } catch (error) {
        setVerificationResult('Ошибка при проверке файлов');
      }
      // Очистить сообщение через 10 секунд
      if (verificationTimeout) clearTimeout(verificationTimeout);
      const timeout = setTimeout(() => setVerificationResult(''), 10000);
      setVerificationTimeout(timeout);
    }
  }, [verificationTimeout]);

  // Функция удаления
  const handleDelete = async (file_hash) => {
    await axios.delete(`${API_URL}/uploads/${file_hash}`);
    // Обновить таблицу
    axios.get(`${API_URL}/uploads?limit=${rowsPerPage}&offset=${page * rowsPerPage}`)
      .then(res => setUploads(res.data.uploads))
      .catch(() => setUploads([]));
  };

  const { getRootProps: getRootProps1, getInputProps: getInputProps1, isDragActive: isDragActive1 } = useDropzone({ onDrop: onDrop1 });
  const { getRootProps: getRootProps2, getInputProps: getInputProps2, isDragActive: isDragActive2 } = useDropzone({ onDrop: onDrop2 });

  return (
    <div>
      <header className="header-bar">
        <img src="https://group-akvilon.ru/images/logo.svg" alt="Логотип" className="logo" />
        <span className="page-title">Проверка файла на изменения</span>
      </header>
      <div className="container">
        <div className="dropzone-section">
          <h2>Зафиксировать сотояние файла</h2>
          <div {...getRootProps1()} className={`dropzone ${isDragActive1 ? 'active' : ''}`} style={{ borderColor: 'blue' }}>
            <input {...getInputProps1()} />
            <p>Перетащите файл(ы) сюда или кликните для выбора</p>
          </div>
          {hashResult && (
            <div className="result" style={{whiteSpace: 'pre-line'}}>{hashResult}</div>
          )}
        </div>

        <div className="dropzone-section">
          <h2>Проверить файл из КонтурДиадок</h2>
          <div {...getRootProps2()} className={`dropzone ${isDragActive2 ? 'active' : ''}`} style={{ borderColor: 'green' }}>
            <input {...getInputProps2()} />
            <p>Перетащите файл(ы) сюда для проверки</p>
          </div>
          {verificationResult && (
            <div className="result" style={{whiteSpace: 'pre-line'}} dangerouslySetInnerHTML={{__html: verificationResult}} />
          )}
        </div>
      </div>
      <div style={{width: '100%', marginTop: 32}}>
        <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
          <label style={{marginRight: 8}}>Показывать по:</label>
          <select value={rowsPerPage} onChange={e => {setRowsPerPage(Number(e.target.value)); setPage(0);}}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <table className="uploads-table">
          <thead>
            <tr>
              <th>Дата/время</th>
              <th>Имя файла</th>
              <th>Имя компьютера</th>
              <th>Хеш файла</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u, i) => (
              <tr key={i}>
                <td>{u.upload_time}</td>
                <td>{u.filename}</td>
                <td>{u.hostname}</td>
                <td style={{fontFamily: 'monospace', fontSize: '0.95em'}}>{u.file_hash}</td>
                <td style={{width: 60, textAlign: 'center'}}>
                  <span className="delete-btn" onClick={e => {e.stopPropagation(); handleDelete(u.file_hash);}} title="Удалить">✖</span>
                </td>
              </tr>
            ))}
            {uploads.length === 0 && (
              <tr><td colSpan={5} style={{textAlign: 'center', color: '#888'}}>Нет данных</td></tr>
            )}
          </tbody>
        </table>
        <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8}}>
          <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>Назад</button>
          <span>Страница {page+1}</span>
          <button onClick={() => setPage(p => p+1)} disabled={uploads.length < rowsPerPage}>Вперёд</button>
        </div>
      </div>
    </div>
  );
}

export default App;
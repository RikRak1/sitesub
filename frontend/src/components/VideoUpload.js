import React, { useState, useRef } from 'react';
import './VideoUpload.css';

const texts = {
  uploadTitle: 'Загрузка видео',
  uploadLabel: 'Перетащите файл или нажмите для выбора',
  formats: 'Форматы: MP4, AVI, MOV',
  maxSize: 'Макс. размер: 5 ГБ',
  uploadButton: 'Загрузить видео',
  fileSelected: 'Выбран файл:',
  removeFile: 'Удалить',
  errorHeader: 'Ошибка загрузки',
  errorMessage: 'Пожалуйста, выберите файл в формате MP4, AVI или MOV',
  okButton: 'Понятно'
};

function VideoUpload({ onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/avi', 'video/quicktime'];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        setError(false);
      } else {
        setError(true);
      }
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/avi', 'video/quicktime'];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        setError(false);
      } else {
        setError(true);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(false);
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="video-upload-container slide-in">
      <div className="upload-header-wrapper">
        <div className="animated-gradient-border">
          <h2>{texts.uploadTitle}</h2>
        </div>
      </div>
      
      <div 
        className="drop-zone"
        onClick={handleClickUpload}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange} 
          style={{ display: 'none' }}
          accept="video/mp4,video/avi,video/quicktime"
        />
        <div className="upload-prompt">
          <div className="upload-icon-container">
            <div className="pulsing-dots">
              <div className="dot dot-1"></div>
              <div className="dot dot-2"></div>
              <div className="dot dot-3"></div>
            </div>
            <svg 
              width="64" 
              height="64" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="var(--accent)"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <p className="upload-label">{texts.uploadLabel}</p>
          <div className="dynamic-lines">
            <p className="file-formats">{texts.formats}</p>
            <p className="file-formats">{texts.maxSize}</p>
          </div>
        </div>
        
        <div className="upload-drag-accent">
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
          <div className="wave wave-3"></div>
        </div>
      </div>
      
      {selectedFile && (
  <div className="file-info">
    <div className="file-info-text">
      <p className="file-name">{texts.fileSelected}</p>
      <div className="file-details">
        <strong className="file-name-text">
          {selectedFile.name}
        </strong>
        <span className="file-size">
          ({Math.round(selectedFile.size / 1024 / 1024)} MB)
        </span>
      </div>
    </div>
    <button 
      className="remove-button"
      onClick={handleRemoveFile}
      title="Удалить выбранный файл"
    >
      {texts.removeFile}
    </button>
  </div>
)}
      
      <button 
        className="glowing-upload-button"
        onClick={handleUpload}
        disabled={!selectedFile}
      >
        <span className="button-content">
          {texts.uploadButton}
        </span>
      </button>
      
      {error && (
        <div className="error-modal">
          <div className="error-content">
            <h3>⚠️ {texts.errorHeader}</h3>
            <p>{texts.errorMessage}</p>
            <button 
              className="ok-button" 
              onClick={() => setError(false)}
            >
              {texts.okButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoUpload;
import React, { useState, useEffect, useRef } from 'react';
import './SubtitleEditor.css';

const SubtitleEditor = ({
  subtitleContent,
  subtitleFormat,
  onSave,
  onReset,
  videoFile,
  onDownloadVideoWithSubtitles,
  isLoading,
}) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef(null);
  const originalContentRef = useRef('');

  useEffect(() => {
    originalContentRef.current = subtitleContent;
    setContent(subtitleContent);
  }, [subtitleContent]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setTimeout(() => {
        textareaRef.current.focus();
      }, 100);
    }
  };

  const handleSave = () => {
    onSave(content);
    setIsEditing(false);
  };

  const handleResetChanges = () => {
    setContent(originalContentRef.current);
    setIsEditing(false);
  };

  const handleContentChange = (e) => {
    setContent(e.target.value);
  };

  return (
    <div className={`subtitle-editor ${isEditing ? 'editing' : ''}`}>
      <div className="editor-header">
        <h2>Редактор субтитров</h2>
        <div className="format-display">
          Текущий формат: <span className="format-badge">{subtitleFormat.toUpperCase()}</span>
        </div>
      </div>

      <div className="video-download-container">
        <button
          className="download-video-btn custom-btn"
          onClick={onDownloadVideoWithSubtitles}
          disabled={isLoading || !videoFile || !content}
        >
          <span className="video-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 9L12 14L7 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 13V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 17H4V20H20V17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              Генерация видео...
            </>
          ) : (
            <>Скачать видео с субтитрами</>
          )}
        </button>
      </div>

      <div className="editor-controls">
        <button className="download-btn" onClick={() => {
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `subtitles.${subtitleFormat}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}>
          Скачать субтитры
        </button>

        <button
          className={isEditing ? "save-btn" : "edit-btn"}
          onClick={isEditing ? handleSave : handleEditToggle}
        >
          {isEditing ? "Сохранить" : "Редактировать"}
        </button>

        {isEditing && (
          <button className="reset-btn" onClick={handleResetChanges}>
            Отменить
          </button>
        )}

        <button className="reset-btn" onClick={onReset}>
          Новое видео
        </button>
      </div>

      <div className="subtitle-editor-container">
        <textarea
          ref={textareaRef}
          className={`editor-textarea ${isEditing ? 'editing' : ''}`}
          value={content}
          onChange={handleContentChange}
          readOnly={!isEditing}
          spellCheck={isEditing}
        />
      </div>
    </div>
  );
};

export default SubtitleEditor;
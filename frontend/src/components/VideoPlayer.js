import React, { useState, useRef } from 'react';
import './VideoPlayer.css';

const texts = {
  playerTitle: 'Настройка генерации субтитров',
  createSubtitlesButton: 'Создать субтитры',
  generatingSubtitles: 'Генерация...',
  resetButton: 'Новое видео',
  languageLabel: 'Язык:',
  modelLabel: 'Модель:',
  formatLabel: 'Формат:',
  speakersLabel: 'Кол-во спикеров:',
  translateLabel: 'Перевод на английский'
};

function VideoPlayer({ 
  videoUrl, 
  onGenerateSubtitles, 
  isLoading,
  onReset,
  fileName = ''
}) {
  const [params, setParams] = useState({
    language: 'ru',
    modelSize: 'base',
    subtitleFormat: 'srt',
    numSpeakers: '2',
    translate: false
  });
  
  const [activeTab, setActiveTab] = useState(0);
  const videoElementRef = useRef(null);

  const modelOptions = [
    { id: 'base', label: 'Базовая (быстро)' },
    { id: 'medium', label: 'Продвинутая (точно)' }
  ];

  const getFileExtension = () => {
    if (fileName) {
      const parts = fileName.split('.');
      if (parts.length > 1) {
        return parts.pop().toLowerCase();
      }
    }
    
    try {
      const url = new URL(videoUrl);
      const pathParts = url.pathname.split('/');
      const lastPart = pathParts.pop();
      if (lastPart.includes('.')) {
        return lastPart.split('.').pop().toLowerCase();
      }
    } catch (e) {
      console.warn("Невозможно разобрать URL:", e);
    }
    
    return '';
  };

  const fileExtension = getFileExtension();
  const isExtensionValid = ['mp4', 'avi', 'mov', 'mkv'].includes(fileExtension);

  const handleParamChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleModelClick = (model) => {
    setParams(prev => ({ ...prev, modelSize: model }));
  };

  const handleTabClick = (index) => {
    setActiveTab(index);
  };

  const handleCreateSubtitles = () => {
    if (!isExtensionValid) {
      return;
    }
    
    const backendParams = {
      modelSize: params.modelSize,
      language: params.language,
      subtitleFormat: params.subtitleFormat,
      numSpeakers: params.numSpeakers,
      translate: params.translate
    };
    
    onGenerateSubtitles(backendParams);
  };

  return (
    <div className="video-player-container slide-up">
      <div className="player-header">
        <h2>{texts.playerTitle}</h2>
        <div className="file-indicator">
          <span className="file-badge">
            <div className="file-dot"></div>
            {fileExtension.toUpperCase()}
          </span>
        </div>
      </div>
      
      {videoUrl && (
        <div className="player-content">
          <div className="video-control-section">
            <div className="video-preview">
              {!isExtensionValid && (
                <div className="video-warning">
                  <span className="warning-icon">⚠️</span>
                  <p>Неподдерживаемый формат: .{fileExtension || 'неизвестно'}</p>
                </div>
              )}
              
              <video
                ref={videoElementRef}
                src={videoUrl}
                controls
                className="video-element"
                poster={`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="%23212733"/><path d="M150 80 L150 145 L200 112.5 Z" fill="%234361ee"/></svg>`}
                preload="metadata"
              >
                <source src={videoUrl} type={`video/${fileExtension}`} />
              </video>
            </div>
            
            <div className="param-tabs">
              <div 
                className={`tab ${activeTab === 0 ? 'active' : ''}`} 
                onClick={() => handleTabClick(0)}
              >
                Основные
              </div>
              <div 
                className={`tab ${activeTab === 1 ? 'active' : ''}`} 
                onClick={() => handleTabClick(1)}
              >
                Дополнительно
              </div>
            </div>
            
            <div className="params-section">
              {activeTab === 0 && (
                <>
                  <div className="param-group">
                    <label className="param-label">
                      <span className="param-icon">🌐</span>
                      {texts.languageLabel}
                    </label>
                    <div className="language-buttons">
                      <button
                        className={`lang-btn ${params.language === 'ru' ? 'active' : ''}`}
                        onClick={() => handleParamChange({target: {name: 'language', value: 'ru'}})}
                        disabled={isLoading}
                        data-lang="ru"
                      >
                        Русский
                      </button>
                      <button
                        className={`lang-btn ${params.language === 'en' ? 'active' : ''}`}
                        onClick={() => handleParamChange({target: {name: 'language', value: 'en'}})}
                        disabled={isLoading}
                        data-lang="en"
                      >
                        Английский
                      </button>
                    </div>
                  </div>

                  <div className="param-group">
                    <label className="param-label">
                      <span className="param-icon">📝</span>
                      {texts.formatLabel}
                    </label>
                    <div className="format-buttons">
                      <button
                        className={`format-btn ${params.subtitleFormat === 'srt' ? 'active' : ''}`}
                        onClick={() => handleParamChange({target: {name: 'subtitleFormat', value: 'srt'}})}
                        disabled={isLoading}
                      >
                        SRT
                      </button>
                      <button
                        className={`format-btn ${params.subtitleFormat === 'vtt' ? 'active' : ''}`}
                        onClick={() => handleParamChange({target: {name: 'subtitleFormat', value: 'vtt'}})}
                        disabled={isLoading}
                      >
                        VTT
                      </button>
                      <button
                        className={`format-btn ${params.subtitleFormat === 'txt' ? 'active' : ''}`}
                        onClick={() => handleParamChange({target: {name: 'subtitleFormat', value: 'txt'}})}
                        disabled={isLoading}
                      >
                        TXT
                      </button>
                    </div>
                  </div>
                  
                  <div className="param-group model-group">
                    <label className="param-label">
                      <span className="param-icon">⚙️</span>
                      {texts.modelLabel}
                    </label>
                    <div className="model-options">
                      {modelOptions.map(model => (
                        <div 
                          key={model.id}
                          className={`model-option ${params.modelSize === model.id ? 'active' : ''}`}
                          onClick={() => handleModelClick(model.id)}
                        >
                          <div className="option-radio">
                            {params.modelSize === model.id && <div className="radio-dot"></div>}
                          </div>
                          <div className="option-label">
                            {model.label}
                            {model.id === 'medium' && <div className="premium-badge">PRO</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === 1 && (
                <>
                  <div className="param-group">
                    <label className="param-label">
                      <span className="param-icon">👥</span>
                      {texts.speakersLabel}
                    </label>
                    <div className="speaker-selector">
                      <input 
                        type="number"
                        name="numSpeakers"
                        min="1"
                        max="5"
                        value={params.numSpeakers}
                        onChange={handleParamChange}
                        disabled={isLoading}
                        className="number-input"
                      />
                      <div className="speaker-icons">
                        {[...Array(5)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`speaker-icon ${i < params.numSpeakers ? 'active' : ''}`}
                            onClick={() => handleParamChange({target: {name: 'numSpeakers', value: i+1}})}
                          >
                            👤
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="param-group checkbox-group">
                    <label className="param-label">
                      <span className="param-icon">🔀</span>
                      {texts.translateLabel}
                    </label>
                    <div className="toggle-switch">
                      <input 
                        type="checkbox"
                        name="translate"
                        checked={params.translate}
                        onChange={handleParamChange}
                        disabled={isLoading}
                        className="toggle-input"
                        id="translateToggle"
                      />
                      <label 
                        className="toggle-label" 
                        htmlFor="translateToggle"
                      ></label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="btn polished-button reset-btn"
              onClick={onReset}
              disabled={isLoading}
            >
              {texts.resetButton}
              <div className="button-glare"></div>
            </button>
            
            <button 
              className={`btn polished-button generate-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleCreateSubtitles}
              disabled={isLoading || !isExtensionValid}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner">
                    <div className="spinner-hand"></div>
                  </div>
                  {texts.generatingSubtitles}
                </>
              ) : (
                <>
                  <span className="button-text">{texts.createSubtitlesButton}</span>
                  <div className="button-wave"></div>
                  <div className="button-particle"></div>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
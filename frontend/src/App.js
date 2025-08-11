import React, { useState, useEffect, useRef } from 'react';
import VideoUpload from './components/VideoUpload';
import VideoPlayer from './components/VideoPlayer';
import SubtitleEditor from './components/SubtitleEditor';
import ThemeToggle from './components/ThemeToggle';
import LoadingOverlay from './components/LoadingOverlay';
import BackgroundShapes from './components/BackgroundShapes';
import './App.css';

const TEXTS = {
  title: 'SubtitleGenius',
  subtitleService: 'Автоматическая транскрипция и дикторизация видео',
  subtitle: 'Превращаем речь в текст с точностью нейросетей',
  footerCopyright: '© 2025 SubtitleGenius. Все права защищены.',
  defaultErrorMessage: 'Произошла ошибка при обработке видео.',
  uploadPrompt: 'Перетащите файл или нажмите для выбора',
  resetButton: 'Новое видео',
  formats: 'Форматы: MP4, AVI, MOV',
  maxSize: 'Макс. размер: 5 ГБ',
  saveSuccess: 'Изменения сохранены успешно!',
  generating: 'Генерирую субтитры...',
  noVideo: 'Загрузите видео для обработки',
  backendError: 'Ошибка на стороне сервера',
  processingError: 'Ошибка обработки видео',
  maxSizeError: 'Слишком большой файл! Максимальный размер: 5 ГБ',
  features: [
    'Точная расшифровка речи',
    'Определение дикторов',
    'Скачивание видео с субтитрами',
    'Редактирование текста'
  ],
  mainMenu: 'Главная',
  aboutMenu: 'О нас',
  supportMenu: 'Поддержка',
  aboutHint: 'Информация о нас',
  supportHint: 'Есть вопросы? Обращайтесь!'
};

const SUPPORTED_LANGUAGES = ['af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 
'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is', 'id', 
'it', 'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi', 'ne', 'no', 'fa', 'pl', 
'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'tl', 'ta', 'th', 'tr', 'uk', 'ur', 
'vi', 'cy'];  // Реальные поддерживаемые языки Whisper

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subtitleData, setSubtitleData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('main');
  const menuRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      const currentPosition = window.scrollY;
      setShowHeader(currentPosition <= 100 || currentPosition < lastScrollPosition);
      setLastScrollPosition(currentPosition);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollPosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) && 
        !event.target.classList.contains('hamburger-icon') && 
        !event.target.classList.contains('hamburger-line')
      ) {
        setIsMenuVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleVideoUpload = (file) => {
    setError(null);
    setVideoFile(file);
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  const handleGenerateSubtitles = async (params) => {
  if (!videoFile) {
    setError(TEXTS.noVideo);
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    const formData = new FormData();
    formData.append('video', videoFile);

    // Преобразуем входной язык: 
    // 1. Если выбран "auto" и он поддерживается сервером, оставляем
    // 2. Если не поддерживается - переназначаем
    let language = params.language;
    
    if (params.language === 'auto') {
      // Проверяем, поддерживает ли бэкенд автоопределение
      // Если нет - используем переназначение на 'ru'
      language = SUPPORTED_LANGUAGES.includes('auto') ? 'auto' : 'ru';
    } else {
      // Для остальных языков: если не поддерживаются, используем резервный вариант
      if (!SUPPORTED_LANGUAGES.includes(params.language)) {
        setError(`Язык '${params.language}' не поддерживается. Используем русский.`);
        language = 'ru';
      }
    }

    const backendParams = {
      model_size: params.modelSize,
      language: language,
      format: params.subtitleFormat.toLowerCase(),
      num_speakers: params.numSpeakers || 2,
      translate: params.translate ? 'true' : 'false'
    };

    Object.entries(backendParams).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(`${BACKEND_URL}/generate-subtitles`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(TEXTS.maxSizeError);
      }
      
      // Обрабатываем специфическую ошибку языка
      if (response.status === 400) {
        const errorData = await response.json();
        if (errorData.error.includes('Unsupported language')) {
          throw new Error(`Неподдерживаемый язык: ${backendParams.language}`);
        }
      }
      
      const errorData = await response.json();
      const errorMessage = errorData.message || TEXTS.backendError;
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.success && data.content) {
      setSubtitleData({
        content: data.content,
        format: data.format || 'srt',
        duration: data.duration || 0,
        segmentsCount: data.segments_count || 0
      });
    } else {
      throw new Error(data.error || TEXTS.processingError);
    }
  } catch (error) {
    console.error('Ошибка генерации субтитров:', error);
    setError(error.message || TEXTS.defaultErrorMessage);
  } finally {
    setIsLoading(false);
  }
};

  const handleSaveSubtitles = (editedContent) => {
    if (subtitleData) {
      setSubtitleData(prev => ({ ...prev, content: editedContent }));
      alert(TEXTS.saveSuccess);
    }
  };

  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setSubtitleData(null);
    setFileName('');
    setError(null);
    setIsLoading(false);
    setIsDownloadingVideo(false);
  };

  const handleDownloadVideoWithSubtitles = async () => {
    setIsDownloadingVideo(true);
    if (!videoFile || !subtitleData) return;

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('subs_content', subtitleData.content);
      formData.append('subs_format', subtitleData.format);
      formData.append('language', 'rus');
      formData.append('filename', fileName);

      const response = await fetch(`${BACKEND_URL}/generate-video-with-subs`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.details || errorData.error || TEXTS.backendError;
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `with_subs_${fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading video with subs:', error);
      setError(error.message);
    } finally {
      setIsDownloadingVideo(false);
    }
  };

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const navigateTo = (section) => {
    setActiveSection(section);
    setIsMenuVisible(false);
  };

  return (
    <div className="app-container">
      <BackgroundShapes theme={theme} />
      {isLoading && <LoadingOverlay message={TEXTS.generating} />}
      {isDownloadingVideo && <LoadingOverlay message="Загрузка видео..." />}

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={handleReset} className="retry-btn">
            {TEXTS.resetButton}
          </button>
        </div>
      )}

      <header className={`app-header ${showHeader ? 'visible' : 'hidden'}`}>
        <div className="header-content">
          {/* Бургер-меню */}
          <div className="hamburger-container">
            <div 
              className="hamburger-icon"
              onClick={() => setIsMenuVisible(!isMenuVisible)}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </div>
            
            {/* Выдвигающееся меню */}
            <div 
              ref={menuRef}
              className={`side-menu ${isMenuVisible ? 'visible' : ''}`}
              onMouseLeave={() => setIsMenuVisible(false)}
            >
              <div className="menu-content">
                <div className="menu-item-container">
                  <div 
                    className={`menu-item ${activeSection === 'main' ? 'active' : ''}`}
                    onClick={() => navigateTo('main')}
                  >
                    <div className="menu-icon">🚀</div>
                    <div className="menu-text">{TEXTS.mainMenu}</div>
                  </div>
                </div>
                
                <div className="menu-item-container">
                  <div 
                    className={`menu-item ${activeSection === 'about' ? 'active' : ''}`}
                    onClick={() => navigateTo('about')}
                  >
                    <div className="menu-icon">❓</div>
                    <div className="menu-text">{TEXTS.aboutMenu}</div>
                  </div>
                  <div className="menu-tooltip">
                    <div className="tooltip-content">
                      <div className="tooltip-text">{TEXTS.aboutHint}</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-item-container">
                  <div 
                    className={`menu-item ${activeSection === 'support' ? 'active' : ''}`}
                    onClick={() => navigateTo('support')}
                  >
                    <div className="menu-icon">💬</div>
                    <div className="menu-text">{TEXTS.supportMenu}</div>
                  </div>
                  <div className="menu-tooltip">
                    <div className="tooltip-content">
                      <div className="tooltip-text">{TEXTS.supportHint}</div>
                    </div>
                  </div>
                </div>
                
                <div className="menu-divider"></div>
                
                <div className="menu-footer">
                  <div className="menu-logo">{TEXTS.title}</div>
                  <div className="menu-version">v1.5.0</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Основное содержимое заголовка */}
          <div className="app-title-container">
            <div className="main-title-row">
              <div className="logo-container">
                <div className="logo-circle">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M17 9L12 14L7 9" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M12 13V4" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M4 8V17C4 18.1046 4.89543 19 6 19H18C19.1046 19 20 18.1046 20 17V8" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h1>{TEXTS.title}</h1>
              </div>
              <ThemeToggle currentTheme={theme} onToggle={handleThemeToggle} />
            </div>
            
            <p className="subtitle">{TEXTS.subtitle}</p>
            
            <div className="features">
              {TEXTS.features.map((feature, index) => (
                <div key={index} className="feature-item">
                  <div className="feature-dot"></div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            
            <div className="file-info">
              <p className="formats">{TEXTS.formats}</p>
              <p className="max-size">{TEXTS.maxSize}</p>
            </div>
          </div>
        </div>
        
        <div className="header-decoration"></div>
      </header>

      <main className="app-content">
        {!videoUrl ? (
          <VideoUpload onUpload={handleVideoUpload} promptText={TEXTS.uploadPrompt} />
        ) : subtitleData ? (
          <SubtitleEditor
            subtitleContent={subtitleData.content}
            subtitleFormat={subtitleData.format}
            onSave={handleSaveSubtitles}
            onReset={handleReset}
            videoFile={videoFile}
            onDownloadVideoWithSubtitles={handleDownloadVideoWithSubtitles}
            isLoading={isDownloadingVideo}
          />
        ) : (
          <VideoPlayer
            videoUrl={videoUrl}
            fileName={fileName}
            onGenerateSubtitles={handleGenerateSubtitles}
            isLoading={isLoading}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>{TEXTS.footerCopyright}</p>
        <div className="footer-decoration">
          <div className="footer-wave"></div>
        </div>
      </footer>
    </div>
  );
}

export default App;
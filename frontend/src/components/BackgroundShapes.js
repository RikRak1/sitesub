import React, { useRef, useEffect } from 'react';
import './BackgroundShapes.css';

const BackgroundShapes = ({ theme }) => {
  const canvasRef = useRef(null);
  
  const INTENSE_COLORS = {
    light: [
      '#4361EE',  // Яркий синий
      '#FF0054',  // Насыщенный малиновый
      '#00C897',  // Ярко-бирюзовый
      '#FF9A00',  // Ослепительный оранжевый
      '#9D4EDD'   // Насыщенный фиолетовый
    ],
    dark: [
      '#3A0CA3',  // Глубокий синий
      '#F72585',  // Электрический розовый
      '#00B2B2',  // Светящийся бирюзовый
      '#FF7F00',  // Ярко-оранжевый
      '#7209B7'   // Интенсивный фиолетовый
    ]
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Очистка холста
    ctx.clearRect(0, 0, canvas.width/dpr, canvas.height/dpr);
    
    // Получаем цвета для текущей темы
    const colors = INTENSE_COLORS[theme] || INTENSE_COLORS.light;
    
    // Рисуем фигуры с усиленной контрастностью
    const drawShapes = () => {
      ctx.clearRect(0, 0, canvas.width/dpr, canvas.height/dpr);
      const shapeCount = theme === 'light' ? 40 : 30; // Больше фигур для светлой темы
      
      for (let i = 0; i < shapeCount; i++) {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const size = theme === 'light' 
          ? 100 + Math.random() * 150  // Больший размер для светлой темы
          : 80 + Math.random() * 120;
        const rotation = Math.random() * Math.PI * 2;
        const colorIdx = Math.floor(Math.random() * colors.length);
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.globalAlpha = theme === 'light' ? 0.85 : 0.7; // Больше непрозрачности
        ctx.fillStyle = colors[colorIdx];
        ctx.filter = 'blur(15px) saturate(180%)'; // Усилим насыщенность
        
        // Усложненные фигуры с контрастными обводками
        ctx.lineWidth = theme === 'light' ? 2 : 1;
        ctx.strokeStyle = '#ffffff' + (theme === 'light' ? '80' : '60');
        
        const shapeType = Math.floor(Math.random() * 5);
        switch(shapeType) {
          case 0: // Большой круг
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
            
          case 1: // Треугольник с двойной рамкой
            ctx.beginPath();
            ctx.moveTo(0, -size/2);
            ctx.lineTo(size/2, size/2);
            ctx.lineTo(-size/2, size/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
            
          case 2: // Прямоугольник
            const width = size;
            const height = size * (0.5 + Math.random() * 0.7);
            ctx.fillRect(-width/2, -height/2, width, height);
            ctx.strokeRect(-width/2, -height/2, width, height);
            break;
            
          case 3: // Кольцо
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha *= 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, size/3.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        
        ctx.restore();
      }
    };
    
    drawShapes();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme]);

  return <canvas ref={canvasRef} className="background-shapes-canvas" />;
};

export default BackgroundShapes;
import React, { useState } from 'react';
import './Menu.css';

const menuItems = [
  { label: 'Главная страница', href: '/' },
  { label: 'О нас', href: '/about' },
  { label: 'Поддержка', href: '/support' },
];

const Menu = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="menu-container">
      <button className="menu-button" onClick={toggleMenu}>
        {/* Иконка трех полосок (можно использовать SVG или иконку из библиотеки) */}
        ☰
      </button>
      {isOpen && (
        <ul className="menu-list">
          {menuItems.map((item) => (
            <li key={item.label}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Menu;
'use client';

import { useState } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-button" onClick={onMenuClick}>
          <div className="menu-icon">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        
        <span style={{ fontSize: '2rem' }}>👔</span>
      </div>

      <div className="welcome-badge">
        ⭐ Bienvenido, Administrador del Sistema ⭐
      </div>

      <button className="logout-button">
        🚪 Cerrar Sesión
      </button>
    </header>
  );
}


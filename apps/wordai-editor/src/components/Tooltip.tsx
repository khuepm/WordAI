import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`tooltip tooltip-${position}`}
          style={{
            position: 'absolute',
            zIndex: 1000,
            padding: '6px 12px',
            background: 'rgba(25, 28, 29, 0.9)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'tooltip-fade-in 0.2s ease-out forwards',
            // Positioning logic
            ...(position === 'right' && { left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)' }),
            ...(position === 'left' && { right: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)' }),
            ...(position === 'top' && { bottom: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }),
            ...(position === 'bottom' && { top: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }),
          }}
        >
          {text}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              ...(position === 'right' && {
                left: '-6px',
                top: '50%',
                marginTop: '-6px',
                borderWidth: '6px 6px 6px 0',
                borderColor: 'transparent rgba(25, 28, 29, 0.9) transparent transparent',
              }),
              ...(position === 'left' && {
                right: '-6px',
                top: '50%',
                marginTop: '-6px',
                borderWidth: '6px 0 6px 6px',
                borderColor: 'transparent transparent transparent rgba(25, 28, 29, 0.9)',
              }),
              ...(position === 'top' && {
                bottom: '-6px',
                left: '50%',
                marginLeft: '-6px',
                borderWidth: '6px 6px 0 6px',
                borderColor: 'rgba(25, 28, 29, 0.9) transparent transparent transparent',
              }),
              ...(position === 'bottom' && {
                top: '-6px',
                left: '50%',
                marginLeft: '-6px',
                borderWidth: '0 6px 6px 6px',
                borderColor: 'transparent transparent rgba(25, 28, 29, 0.9) transparent',
              }),
            }}
          />
        </div>
      )}
    </div>
  );
};

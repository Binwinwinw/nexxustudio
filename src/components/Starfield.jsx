/* src/components/Starfield.jsx */
import React, { useEffect, useRef } from 'react';

/**
 * Starfield - Moteur de rendu stellaire haute performance (Canvas 2D)
 * Refactoré par Sentinel : Styles inline extraits vers Tailwind.
 */
const Starfield = ({ speed = 0.05, count = 100, active = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const stars = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.5,
      opacity: Math.random(),
      speed: (Math.random() * 0.5 + 0.1) * (active ? 2 : 1)
    }));

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * (active ? 0.8 : 0.4)})`;
        ctx.fill();

        star.y += star.speed * (active ? 3 : 1);
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count, active]);

  // Refactor Sentinel : Utilisation de Tailwind au lieu de style={{...}}
  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-screen h-screen pointer-events-none -z-10 opacity-100"
    />
  );
};

export default Starfield;
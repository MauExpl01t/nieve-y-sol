// Marca de Nieve y Sol: un amanecer sobre una cumbre nevada, con una poza termal que humea al pie.
// El mismo dibujo está en frontend/public/favicon.svg (ícono de la pestaña del navegador).
// Lo usan la barra lateral y la pantalla de inicio de sesión.
import { useId } from 'react';

// Los ids de los degradados deben ser únicos si el dibujo aparece dos veces en la misma página.
function useIds() {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

function Escena({ k }) {
  return (
    <>
  <defs>
    <linearGradient id={`${k}cielo`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#082A36"/>
      <stop offset="0.38" stopColor="#17697A"/>
      <stop offset="0.62" stopColor="#5FB1B1"/>
      <stop offset="0.8" stopColor="#F5D79A"/>
      <stop offset="1" stopColor="#FBC774"/>
    </linearGradient>
    <radialGradient id={`${k}halo`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#FFF4CF" stopOpacity="0.95"/>
      <stop offset="0.35" stopColor="#FFD98A" stopOpacity="0.55"/>
      <stop offset="1" stopColor="#FFC15A" stopOpacity="0"/>
    </radialGradient>
    <radialGradient id={`${k}sol`} cx="0.4" cy="0.38" r="0.75">
      <stop offset="0" stopColor="#FFFBE8"/>
      <stop offset="0.5" stopColor="#FFE08A"/>
      <stop offset="1" stopColor="#FFB93D"/>
    </radialGradient>
    <linearGradient id={`${k}sombra`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#27576B"/>
      <stop offset="1" stopColor="#0B2B38"/>
    </linearGradient>
    <linearGradient id={`${k}luz`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#E9B67C"/>
      <stop offset="0.35" stopColor="#7F9FA0"/>
      <stop offset="1" stopColor="#1E5360"/>
    </linearGradient>
    <linearGradient id={`${k}lejos`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8CC6C0"/>
      <stop offset="1" stopColor="#3C8A92"/>
    </linearGradient>
    <linearGradient id={`${k}agua`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#B7E3D6"/>
      <stop offset="0.3" stopColor="#52B1B3"/>
      <stop offset="1" stopColor="#125A66"/>
    </linearGradient>
    <filter id={`${k}vapor`} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.7"/>
    </filter>
    <clipPath id={`${k}marco`}><rect width="64" height="64" rx="15"/></clipPath>
  </defs>
  <g clipPath={`url(#${k}marco)`}>
    <rect width="64" height="64" fill={`url(#${k}cielo)`}/>

    {/* sol y su resplandor */}
    <circle cx="47" cy="33" r="25" fill={`url(#${k}halo)`}/>
    <circle cx="47" cy="33" r="8.2" fill={`url(#${k}sol)`}/>

    {/* cordón lejano, con el sol saliendo detrás */}
    <path d="M26 54 L33 45 L38 48 L44 41.5 L50 46.5 L55 42.5 L70 52 V56 H26 Z" fill={`url(#${k}lejos)`}/>
    <path d="M26 54 L33 45 L38 48 L44 41.5 L50 46.5 L55 42.5 L70 52" fill="none" stroke="#F7E3B5" strokeWidth="0.6" strokeLinejoin="round" opacity="0.45"/>

    {/* cumbre principal: cara en sombra (izquierda) y cara iluminada (derecha) */}
    <path d="M20 8 L-9 54 L27 54 L22.5 38 L26 24.5 Z" fill={`url(#${k}sombra)`}/>
    <path d="M20 8 L26 24.5 L22.5 38 L27 54 L52 54 Z" fill={`url(#${k}luz)`}/>
    <path d="M26 24.5 L22.5 38 L27 54" fill="none" stroke="#05202A" strokeWidth="0.6" opacity="0.5"/>
    <path d="M14 36 L9 46 M17.5 31 L16 42 M31 36 L36 46 M29 30 L33 39" stroke="#05202A" strokeWidth="0.6" strokeLinecap="round" opacity="0.28"/>

    {/* nieve: azulada en sombra, cálida donde da el sol */}
    <path d="M20 8 L26 24.5 L23.2 21.4 L21 28 L17.4 22.4 L14.2 28.4 L11.4 22.6 L8.7 27 Z" fill="#CFE2EC"/>
    <path d="M20 8 L26 24.5 L27.8 29.2 L30.6 24.6 L33 29 L35 26.8 Z" fill="#FFF3D3"/>
    <path d="M20 8 L26 24.5 L23.2 21.4 L21 28 L17.4 22.4" fill="none" stroke="#FFFFFF" strokeWidth="0.8" strokeLinejoin="round" opacity="0.9"/>

    {/* pinos al pie de la ladera */}
    <g fill="#06232A">
      <path d="M31 40 L28.2 49 H33.8 Z"/>
      <path d="M36 43 L33.6 50.5 H38.4 Z"/>
      <path d="M26.5 44 L24.4 51 H28.6 Z"/>
    </g>

    {/* poza termal */}
    <path d="M0 50.5 Q10 48.8 20 50.2 T40 50 T64 49.5 V64 H0 Z" fill={`url(#${k}agua)`}/>
    {/* reflejo del sol */}
    <g fill="#FFF0BF">
      <rect x="44" y="51.2" width="6.5" height="1" rx="0.5" opacity="0.9"/>
      <rect x="45" y="53.4" width="5" height="0.9" rx="0.45" opacity="0.75"/>
      <rect x="45.8" y="55.4" width="3.6" height="0.8" rx="0.4" opacity="0.6"/>
      <rect x="46.4" y="57.2" width="2.4" height="0.7" rx="0.35" opacity="0.45"/>
    </g>
    {/* ondas */}
    <g fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeLinecap="round">
      <path d="M8 55 q4 -1.6 8 0" opacity="0.5"/>
      <path d="M22 58.4 q5 -1.8 10 0" opacity="0.4"/>
      <path d="M36 61 q4 -1.4 8 0" opacity="0.3"/>
    </g>
    {/* piedras del borde */}
    <path d="M0 57.5 Q4 54.8 9 57.2 Q12.5 59 11.5 64 H0 Z" fill="#1A3841"/>
    <path d="M0 57.5 Q4 54.8 9 57.2" fill="none" stroke="#6A8F98" strokeWidth="0.6" opacity="0.7"/>
    <path d="M64 56.5 Q58 54.8 53 58 Q50.5 60.5 51.5 64 H64 Z" fill="#1A3841"/>
    <path d="M64 56.5 Q58 54.8 53 58" fill="none" stroke="#6A8F98" strokeWidth="0.6" opacity="0.7"/>

    {/* vapor */}
    <g fill="none" stroke="#FFFFFF" strokeLinecap="round" filter={`url(#${k}vapor)`}>
      <path d="M39.5 50 q-3.4 -4 0 -8 q3.4 -4 0 -8" strokeWidth="2" opacity="0.5"/>
      <path d="M43.5 49 q-2.6 -3.4 0 -6.8 q2.6 -3.4 0 -6.8" strokeWidth="1.6" opacity="0.38"/>
    </g>
  </g>
  <rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.25"/>
    </>
  );
}

export function LogoNieveYSol({ className = 'marca-icono' }) {
  const k = useIds();
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <Escena k={`${k}a`} />
    </svg>
  );
}

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...props }) => {
  const baseStyles =
    "relative group overflow-hidden rounded-full px-9 py-4 uppercase tracking-[0.22em] text-[12px] font-bold transition-all duration-300 ease-out font-sans flex items-center justify-center gap-2 will-change-transform transform-gpu hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary:
      "bg-gradient-to-r from-gold-300 via-gold-500 to-gold-700 text-black border border-gold-300/70 shadow-gold-glow",
    outline:
      "bg-black/5 text-gray-800 border border-black/10 hover:border-gold-400/40 hover:bg-black/10 shadow-[0_18px_50px_-40px_rgba(2,6,23,0.35)] dark:bg-white/[0.03] dark:text-gold-200 dark:border-gold-500/30 dark:hover:border-gold-300/70 dark:hover:bg-white/[0.05] dark:shadow-[0_22px_70px_-50px_rgba(0,0,0,0.95)]",
    ghost: "bg-transparent text-gray-600 hover:text-gold-600 hover:pl-2 dark:text-gray-400 dark:hover:text-gold-500",
  };

  if (variant === 'ghost') {
    return (
      <button className={`${baseStyles} ${variants.ghost} ${className}`} {...props}>
        {children}
      </button>
    );
  }

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      <span
        className={`absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500 ${
          variant === 'primary' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
        } ring-1 ring-gold-400/20 group-hover:ring-gold-300/50`}
      />
      <span
        className={`absolute inset-[1px] rounded-full pointer-events-none ${
          variant === 'primary'
            ? 'bg-gradient-to-b from-white/25 via-white/0 to-black/10'
            : 'bg-gradient-to-b from-white/12 via-white/0 to-black/25'
        }`}
      />
      <span
        className={`absolute inset-0 w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${
          variant === 'primary'
            ? 'bg-white/85 -translate-x-full group-hover:translate-x-0'
            : 'bg-gold-400/95 translate-y-full group-hover:translate-y-0'
        }`}
      />
      <span className="absolute -inset-y-10 -left-1/2 w-[65%] rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 blur-sm transition-all duration-700 group-hover:opacity-100 group-hover:left-[110%] pointer-events-none" />
      
      <span className="relative z-10 transition-colors duration-300 group-hover:text-black">
        {children}
      </span>
    </button>
  );
};

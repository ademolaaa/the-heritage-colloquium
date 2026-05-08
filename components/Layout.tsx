import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { useSiteContent } from './SiteContentProvider';
import { SmartImage } from './ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC = () => {
  const { content } = useSiteContent();
  const { user, logout, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const location = useLocation();

  // Global Background Logic
  const globalBg = content.globalBackground;
  // Only show image background globally (video is handled in Home hero)
  const hasGlobalBg = globalBg && globalBg.type === 'image';
  const scrolledRef = useRef(false);
  const menuOpenRef = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [navHeight, setNavHeight] = useState(96);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    scrolledRef.current = scrolled;
  }, [scrolled]);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const next = el.getBoundingClientRect().height;
      setNavHeight((prev) => {
        const shouldTrackExpanded = !scrolledRef.current && !menuOpenRef.current;
        const candidate = shouldTrackExpanded ? next : Math.max(prev, next);
        return Math.abs(prev - candidate) > 0.5 ? candidate : prev;
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    schedule();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    ro?.observe(el);
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    const params = new URLSearchParams(location.search || '');
    const section = (params.get('section') || '').replace(/^#/, '');
    const hash = (location.hash || '').replace(/^#/, '');
    const targetId = section || hash;
    if (!targetId) {
      window.scrollTo(0, 0);
      return;
    }
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }, [location.pathname, location.search, location.hash, navHeight]);

  const navLinks = content.nav.filter((l) => l.path !== '/admin' && l.path !== '/' && !l.hidden);
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const headerLinks = isAdminRoute
    ? [
        { label: 'Console', path: '/admin/console' },
        { label: 'Uploads', path: '/admin/uploads' },
      ]
    : isAdmin 
      ? [...navLinks, { label: 'Admin', path: '/admin/console' }]
      : navLinks;
  const logoFallback = placeholderImageDataUri({ width: 128, height: 128, label: content.brand.wordmark });
  const toggleTheme = () => {
    const current = document.documentElement.classList.contains('dark');
    const next = !current;
    setIsDark(next);
    try {
      const key = 'heritage.theme';
      localStorage.setItem(key, next ? 'dark' : 'light');
    } catch {}
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <div className="min-h-screen bg-obsidian text-offwhite font-sans relative">
      {/* Global Background */}
      {hasGlobalBg && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {globalBg.type === 'image' && globalBg.imageUrl && (
            <SmartImage
              src={globalBg.imageUrl}
              fallbackSrc=""
              alt="Background"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Overlay to ensure text readability */}
          <div 
            className="absolute inset-0 bg-obsidian transition-opacity duration-700"
            style={{ opacity: 1 - (globalBg.opacity ?? 0.3) }}
          />
        </div>
      )}

      {/* Film Grain Overlay */}
      <div className="bg-noise fixed inset-0 z-[1] pointer-events-none opacity-50" />

      {/* Navigation */}
      <nav 
        ref={navRef}
        className={`fixed top-0 w-full z-50 transition-all duration-700 border-b ${
          scrolled || menuOpen 
            ? 'bg-obsidian/80 backdrop-blur-xl border-white/5 py-3' 
            : 'bg-transparent border-transparent py-8'
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
          <NavLink to="/" className="z-50 group relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 bg-black/30">
                <SmartImage src={content.brand.logoUrl} fallbackSrc={logoFallback} alt={content.brand.wordmark} className="w-full h-full object-cover" />
              </div>
              <div className="leading-none">
                <h1 className="font-display text-xl md:text-2xl tracking-[0.15em] text-white group-hover:text-gold-500 transition-colors duration-500">
                  {content.brand.wordmark}
                </h1>
                <span className="text-[0.55rem] uppercase tracking-[0.4em] text-gold-500 group-hover:text-white transition-colors duration-500 block opacity-80">
                  {content.brand.tagline}
                </span>
              </div>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {headerLinks.map((link) => (
              <NavLink 
                key={link.path}
                to={link.path}
                className={({ isActive }) => 
                  `text-xs md:text-sm tracking-wide transition-all duration-300 relative group py-2
                   ${isActive ? 'text-gold-500 font-semibold' : 'text-gray-300 hover:text-white'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    <span className={`absolute bottom-0 left-0 w-full h-[1px] bg-gold-500 origin-left transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'}`} />
                  </>
                )}
              </NavLink>
            ))}
            
            <div className="h-4 w-[1px] bg-white/10 mx-2"></div>
            
            {user ? (
              <div className="flex items-center gap-4">
                <NavLink to="/profile" className="text-xs text-gold-500 hover:text-white transition-colors">
                  {user.username}
                </NavLink>
                <Button variant="ghost" onClick={logout} className="!py-1 !px-3 !text-[10px]">
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <NavLink to="/login" className="text-xs text-gray-300 hover:text-white transition-colors">
                  Sign In
                </NavLink>
                <NavLink to="/register">
                  <Button variant="outline" className="!py-1 !px-3 !text-[10px] !border-gold-500/50 hover:!bg-gold-500/10">
                    Join
                  </Button>
                </NavLink>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="ml-1 w-10 h-10 rounded-full border border-black/10 bg-black/5 text-gray-700 hover:bg-black/10 hover:border-gold-400/40 transition-colors flex items-center justify-center dark:border-gold-500/25 dark:bg-white/[0.02] dark:text-gold-300 dark:hover:border-gold-400 dark:hover:bg-white/[0.04]"
              aria-label="Toggle theme"
            >
              {isDark ? '☀' : '☾'}
            </button>
            {isAdminRoute && (
              <NavLink to="/" className="ml-2">
                <Button variant="ghost" className="!py-2 !px-4 !text-[10px]">Back to Site</Button>
              </NavLink>
            )}
          </div>

          {/* Mobile Toggle */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden z-50 text-gold-500 focus:outline-none p-2"
          >
            <div className={`w-6 h-[1px] bg-current mb-1.5 transition-all duration-500 ease-in-out ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`w-4 h-[1px] bg-current mb-1.5 ml-auto transition-all duration-500 ease-in-out ${menuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-6 h-[1px] bg-current transition-all duration-500 ease-in-out ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-obsidian/95 backdrop-blur-3xl z-40 flex flex-col items-center justify-center overflow-y-auto"
            style={{ paddingTop: navHeight }}
          >
            <div className="flex flex-col gap-8 text-center py-16">
              {headerLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className="text-2xl font-serif text-gray-400 hover:text-gold-500 italic transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
              
              <div className="w-12 h-[1px] bg-white/10 mx-auto my-4"></div>
              
              {user ? (
                <div className="flex flex-col gap-4">
                  <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="text-gold-500 hover:text-white transition-colors">
                    Hello, {user.username}
                  </NavLink>
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="text-sm text-gray-400 hover:text-white">
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <NavLink to="/login" onClick={() => setMenuOpen(false)} className="text-xl text-white">Sign In</NavLink>
                  <NavLink to="/register" onClick={() => setMenuOpen(false)} className="text-xl text-gold-500">Join Community</NavLink>
                </div>
              )}

              <button
                type="button"
                onClick={toggleTheme}
                className="text-[10px] uppercase tracking-[0.25em] text-gray-500 hover:text-gold-500 transition-colors mt-8"
              >
                Switch to {isDark ? 'Light' : 'Dark'} Mode
              </button>
              <div className="mt-2">
                {isAdminRoute && (
                  <NavLink to="/" className="text-xs uppercase tracking-[0.25em] text-gray-500 hover:text-gold-500 transition-colors">
                    Back to Site
                  </NavLink>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 min-h-[80vh]" style={{ paddingTop: navHeight }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-charcoal border-t border-white/5 pt-24 pb-12 relative overflow-hidden">
        {/* Decorative footer line */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold-900 to-transparent opacity-50" />
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-20">
            <div className="col-span-1 md:col-span-2 space-y-8">
              <h2 className="font-display text-3xl tracking-widest text-gold-500">{content.brand.wordmark}</h2>
              <p className="text-gray-500 max-w-md leading-loose font-light text-sm">
                {content.footer.description}
              </p>
            </div>
            
            <div>
              <h3 className="text-white text-[10px] uppercase tracking-[0.2em] mb-8 font-semibold opacity-60">Explore</h3>
              <ul className="space-y-4">
                {[
                  { label: 'About', path: '/about' },
                  { label: 'Lecture Series', path: '/lecture-series' },
                  { label: 'Gallery', path: '/gallery' },
                  { label: 'News', path: '/blog' },
                  { label: 'Contact', path: '/contact' },
                ].map((link) => (
                  <li key={link.path}>
                    <NavLink to={link.path} className="text-gray-500 hover:text-gold-400 transition-colors text-sm">
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-white text-[10px] uppercase tracking-[0.2em] mb-8 font-semibold opacity-60">Resources</h3>
              <ul className="space-y-4">
                {[
                  { label: 'Archive', path: '/lectures' },
                  { label: 'Repository', path: '/resources' },
                  { label: 'Support', path: '/sponsors' },
                ].map((link) => (
                  <li key={link.path}>
                    <NavLink to={link.path} className="text-gray-500 hover:text-gold-400 transition-colors text-sm">
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-white text-[10px] uppercase tracking-[0.2em] mb-8 font-semibold opacity-60">Social</h3>
              <ul className="space-y-4">
                <li>
                  <a href={content.social?.twitter || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gold-400 transition-colors text-xs group flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gold-500/50 group-hover:bg-gold-500 transition-colors"></span>
                    Twitter / X
                  </a>
                </li>
                <li>
                  <a href={content.social?.linkedin || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gold-400 transition-colors text-xs group flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gold-500/50 group-hover:bg-gold-500 transition-colors"></span>
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href={content.social?.instagram || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gold-400 transition-colors text-xs group flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gold-500/50 group-hover:bg-gold-500 transition-colors"></span>
                    Instagram
                  </a>
                </li>
                {/* Embed Social Feed Link */}
                <li className="pt-2 border-t border-white/5">
                    <NavLink to="/feed" className="text-gold-500 hover:text-white transition-colors text-xs flex items-center gap-2 font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                        </svg>
                        Community Feed
                    </NavLink>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-700 uppercase tracking-widest">
            <p>&copy; {new Date().getFullYear()} {content.brand.wordmark}. All rights reserved.</p>
            <p className="mt-4 md:mt-0 opacity-50 hover:opacity-100 transition-opacity">{content.footer.credit}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

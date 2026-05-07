import React from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useSiteContent } from '../components/SiteContentProvider';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';

export const Home: React.FC = () => {
  const { content } = useSiteContent();
  const globalBg = content.globalBackground;
  const hasGlobalVideo = globalBg && globalBg.type === 'video' && globalBg.videoUrl;

  const featuredLecture = content.lectures[0];
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const heroFallback = placeholderImageDataUri({ width: 1920, height: 1080, label: 'Heritage' });
  const mandateFallback = placeholderImageDataUri({ width: 900, height: 1200, label: 'Cultural Heritage' });

  return (
    <>
      {/* Hero Section */}
      <div className="relative h-screen min-h-[800px] flex items-center justify-center overflow-hidden bg-obsidian">
        {/* Background Image with Slow Zoom */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {hasGlobalVideo ? (
            <video
              src={globalBg.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          ) : (
            <motion.div 
              className="w-full h-full"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
            >
              <SmartImage
                src={content.home.heroBackgroundImage}
                fallbackSrc={heroFallback}
                alt={content.home.heroBackgroundAlt}
                className="w-full h-full object-cover opacity-30 grayscale contrast-125"
              />
            </motion.div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-obsidian/40 via-transparent to-obsidian" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center mt-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="mb-8 flex items-center gap-4 opacity-70">
              <div className="h-[1px] w-12 bg-gold-500/50" />
              <h2 className="text-gold-400 tracking-[0.5em] uppercase text-xs font-semibold">
                {content.home.heroKicker}
              </h2>
              <div className="h-[1px] w-12 bg-gold-500/50" />
            </div>

            <h1 className="font-display text-6xl md:text-8xl lg:text-9xl text-white mb-8 leading-[1.05] tracking-tight shadow-black drop-shadow-lg">
              <span className="block">{content.home.heroTitleLine1}</span>
              <span className="block mt-2 md:mt-3 text-transparent bg-clip-text bg-gradient-to-br from-gold-200 via-gold-500 to-gold-800 italic">
                {content.home.heroTitleEmphasis}
              </span>
            </h1>
            
            <p className="max-w-xl mx-auto text-gray-400 text-lg md:text-xl font-light mb-12 leading-relaxed font-serif italic opacity-90">
              {content.home.heroQuote}
            </p>
            
            <motion.div 
              className="flex flex-col md:flex-row gap-6 justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
            >
              <Link to={content.home.heroSecondaryCtaTo}>
                <Button>{content.home.heroSecondaryCtaLabel}</Button>
              </Link>
              <Link to="/gallery">
                <Button variant="outline">View Gallery</Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Scroll Indicator */}
        <motion.div 
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50"
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        >
          <span className="text-[10px] uppercase tracking-widest text-gold-500/80">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-gold-500 to-transparent" />
        </motion.div>
      </div>

      {/* Intro Section */}
      <Section background="pattern" className="border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <motion.div style={{ y: y1 }}>
            <div className="w-20 h-0.5 bg-gold-500 mb-10" />
            <h2 className="font-serif text-4xl md:text-5xl text-white mb-8 leading-tight">{content.home.mandateTitle}</h2>
            <p className="text-gray-400 leading-loose mb-8 font-light text-lg">
              {content.home.mandateParagraph1}
            </p>
            <p className="text-gray-400 leading-loose font-light">
              {content.home.mandateParagraph2}
            </p>
          </motion.div>
          <div className="relative group">
            <div className="absolute -inset-1 border border-gold-500/20 z-0 translate-x-4 translate-y-4 duration-700 transition-transform group-hover:translate-x-2 group-hover:translate-y-2" />
            <div className="relative z-10 overflow-hidden">
              <SmartImage
                src={content.home.mandateImage}
                fallbackSrc={mandateFallback}
                alt="Cultural Artefact"
                className="w-full h-[600px] object-cover grayscale contrast-125 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000 ease-out"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>
          </div>
        </div>
      </Section>

      {/* Featured Lecture */}
      <Section background="darker">
        <div className="text-center mb-20">
          <h2 className="text-gold-500 tracking-[0.3em] text-xs uppercase mb-4 font-semibold">{content.home.keynoteLabel}</h2>
          <h3 className="font-display text-4xl md:text-5xl text-white">The 2024 Keynote</h3>
        </div>

        <div className="max-w-6xl mx-auto bg-charcoal border border-white/5 overflow-hidden group hover:border-gold-500/30 transition-all duration-700 shadow-2xl shadow-black">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative overflow-hidden h-96 md:h-[500px]">
              <SmartImage
                src={featuredLecture.image}
                fallbackSrc={placeholderImageDataUri({ width: 1400, height: 1050, label: 'Keynote Portrait' })}
                alt={featuredLecture.speaker}
                className="w-full h-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-110 grayscale group-hover:grayscale-0" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80 group-hover:opacity-40 transition-opacity duration-700" />
            </div>
            <div className="p-16 flex flex-col justify-center relative">
              <div className="absolute top-0 right-0 p-16 opacity-5 font-display text-9xl text-white select-none pointer-events-none">
                {featuredLecture.year}
              </div>
              
              <div className="relative z-10">
                <span className="text-gold-500 font-mono text-xs mb-6 block tracking-widest uppercase border-l-2 border-gold-500 pl-4">
                   Theme: {featuredLecture.theme}
                </span>
                <h4 className="font-display text-3xl md:text-4xl text-white mb-4 leading-tight">{featuredLecture.title}</h4>
                <p className="text-xl text-gray-300 italic font-serif mb-8">— {featuredLecture.speaker}</p>
                <p className="text-gray-400 text-sm leading-loose mb-10 font-light max-w-md">
                  {featuredLecture.description}
                </p>
                <Link to={`/lectures#${featuredLecture.id}`}>
                  <Button variant="outline">Read Full Profile</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Repository (Resources/Downloads) Section */}
      <Section background="pattern">
        <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-8">
           <div>
            <h2 className="text-gold-500 tracking-[0.3em] text-xs uppercase mb-3 font-semibold">Repository</h2>
            <h3 className="font-serif text-3xl md:text-4xl text-white italic">Documents & Resources</h3>
           </div>
           <Link to="/resources" className="text-gold-500 text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors">
            View All
           </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {content.downloads.slice(0, 3).map((dl) => (
             <div key={dl.id} className="group border border-white/5 bg-charcoal/50 p-8 hover:border-gold-500/30 transition-all">
                <div className="text-gold-500 mb-4 opacity-70 group-hover:opacity-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h4 className="text-white font-display text-xl mb-2 group-hover:text-gold-400">{dl.title}</h4>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-6">{dl.type} • {dl.size}</div>
                <a 
                  href={dl.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[10px] uppercase tracking-[0.2em] text-white/50 group-hover:text-white transition-colors flex items-center gap-2"
                >
                  Download <span className="text-gold-500">→</span>
                </a>
             </div>
           ))}
        </div>
      </Section>

      {/* Social Feed Section */}
      <Section background="pattern">
        <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-8">
           <div>
            <h2 className="text-gold-500 tracking-[0.3em] text-xs uppercase mb-3 font-semibold">Community Voices</h2>
            <h3 className="font-serif text-3xl md:text-4xl text-white italic">Join the Conversation</h3>
           </div>
           <Link to="/feed" className="text-gold-500 text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors">
            View Full Feed
           </Link>
        </div>
        
        {/* If embed code is present, show it, otherwise show a teaser of the feed */}
        {content.home.socialFeedEmbedCode ? (
             <div className="w-full" dangerouslySetInnerHTML={{ __html: content.home.socialFeedEmbedCode }} />
        ) : (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Simulated Feed Items / Teasers */}
                <div className="bg-charcoal/50 border border-white/5 p-6 rounded-sm hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-xs">A</div>
                        <div className="text-xs text-gray-400">@ahiajoku_fan</div>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">The upcoming lecture theme on Igbo Economy is exactly what we need right now. Can't wait!</p>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">2 hours ago</div>
                </div>

                <div className="bg-charcoal/50 border border-white/5 p-6 rounded-sm hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-xs">N</div>
                        <div className="text-xs text-gray-400">@ngozi_writes</div>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">Just uploaded a video of the Ohafia War Dance from last year's festival. The energy was electric! ⚡️</p>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">5 hours ago</div>
                </div>

                <div className="bg-charcoal/50 border border-white/5 p-6 rounded-sm flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-black/40 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-500 mb-4 group-hover:bg-gold-500 group-hover:text-black transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </div>
                    <h4 className="text-white font-display text-lg mb-2">Share Your Voice</h4>
                    <p className="text-gray-500 text-sm mb-6 max-w-[200px]">Post photos, videos, and thoughts about the colloquium.</p>
                    <Link to="/feed">
                        <Button variant="outline" className="!text-xs !py-2">Post Update</Button>
                    </Link>
                </div>
             </div>
        )}
      </Section>

      {/* News & Updates */}
      <Section>
        <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white italic">{content.home.announcementsTitle}</h2>
          <Link to="/blog" className="text-gold-500 text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors">
            {content.home.announcementsCtaLabel}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {content.announcements.map((news) => (
            <div key={news.id} className="group cursor-pointer border-l border-transparent hover:border-gold-500 pl-6 transition-all duration-500 hover:pl-8">
              <div className="text-gold-600 text-[10px] mb-3 font-mono tracking-widest uppercase">{news.date}</div>
              <h3 className="text-2xl text-white font-display mb-4 group-hover:text-gold-400 transition-colors leading-snug">{news.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed font-light">{news.excerpt}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Sponsor CTA */}
      <Section background="pattern" className="text-center pb-32">
        <div className="max-w-4xl mx-auto py-20 border border-gold-500/10 bg-gradient-to-b from-charcoal/50 to-obsidian p-12 backdrop-blur-md relative overflow-hidden">
          {/* Decorative Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-gold-500" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold-500" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gold-500" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-gold-500" />

          <h2 className="font-display text-4xl md:text-5xl text-white mb-6">Custodians of Culture</h2>
          <p className="text-gray-400 mb-10 text-lg font-light leading-relaxed max-w-2xl mx-auto">
            Partner with the Heritage Colloquium to position your organization at the intersection of intellectual prestige and cultural preservation.
          </p>
          <Link to="/sponsors">
            <Button>View Partnership Tiers</Button>
          </Link>
        </div>
      </Section>
    </>
  );
};

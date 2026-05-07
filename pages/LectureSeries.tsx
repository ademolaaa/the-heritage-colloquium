import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '../components/Section';
import { useSiteContent } from '../components/SiteContentProvider';
import { Button } from '../components/ui/Button';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const LectureSeries: React.FC = () => {
  const { content } = useSiteContent();
  const ls = content.lectureSeries;

  const portraitFallback = useMemo(() => placeholderImageDataUri({ width: 900, height: 1100, label: 'Speaker Portrait' }), []);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const item = items[clamped];
    const targetLeft = item.offsetLeft - (el.clientWidth - item.clientWidth) / 2;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const updateActive = () => {
      const items = Array.from(el.children) as HTMLElement[];
      if (items.length === 0) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      items.forEach((item, idx) => {
        const itemCenter = item.offsetLeft + item.clientWidth / 2;
        const dist = Math.abs(itemCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = idx;
        }
      });
      setActiveIndex(best);
    };

    updateActive();
    el.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      el.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
    };
  }, [ls.pastSpeakers.length]);

  return (
    <>
      <div className="pt-36 pb-20 bg-obsidian border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h1 className="font-display text-5xl md:text-7xl text-white mb-6">{ls.title}</h1>
          <p className="text-gray-400 max-w-3xl mx-auto text-lg font-serif italic">{ls.subtitle}</p>
          <div className="mt-10 flex justify-center gap-4">
            <a href="#history">
              <Button variant="outline">The Legacy</Button>
            </a>
            <a href="#speakers">
              <Button>Past Speakers</Button>
            </a>
          </div>
        </div>
      </div>

      <Section id="history" background="pattern" className="border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-10">{ls.briefHistoryTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-7">
              <ul className="space-y-6">
                {ls.briefHistoryBullets.map((item, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="mt-1.5 w-2 h-2 bg-gold-500/80 rounded-full flex-none" />
                    <p className="text-gray-300 leading-relaxed font-light">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-5">
              <div className="p-10 border border-white/5 bg-charcoal/40 backdrop-blur-sm">
                <div className="text-gold-500 text-[10px] uppercase tracking-[0.3em] mb-4 font-semibold">Institutional Notes</div>
                <div className="space-y-6 text-sm text-gray-400 leading-loose">
                  <p>
                    The Lecture Series stands as a cultural think tank—preserving memory, sharpening policy, and renewing identity through
                    scholarship.
                  </p>
                  <p>Its enduring mandate is simple: transform heritage into governance, and memory into progress.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="speakers" background="darker">
        <div className="max-w-6xl mx-auto mb-10 flex flex-col items-center text-center">
          <h2 className="text-gold-500 tracking-[0.3em] text-xs uppercase mb-4 font-semibold">{ls.pastSpeakersTitle}</h2>
          <p className="text-gray-400 max-w-3xl mx-auto font-light">{ls.pastSpeakersSubtitle}</p>
          <div className="mt-10 flex items-center gap-4">
            <button
              className="w-11 h-11 rounded-full border border-gold-500/25 bg-white/[0.02] text-gold-300 hover:border-gold-400 hover:text-gold-200 transition-colors"
              onClick={() => scrollToIndex(activeIndex - 1)}
              aria-label="Previous speaker"
            >
              ‹
            </button>
            <div className="flex items-center gap-2">
              {ls.pastSpeakers.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => scrollToIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex ? 'w-10 bg-gold-500' : 'w-3 bg-white/10 hover:bg-white/20'
                  }`}
                  aria-label={`Go to ${s.name}`}
                />
              ))}
            </div>
            <button
              className="w-11 h-11 rounded-full border border-gold-500/25 bg-white/[0.02] text-gold-300 hover:border-gold-400 hover:text-gold-200 transition-colors"
              onClick={() => scrollToIndex(activeIndex + 1)}
              aria-label="Next speaker"
            >
              ›
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div ref={trackRef} className="flex gap-8 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth">
            {ls.pastSpeakers.map((speaker, idx) => (
              <motion.div
                key={speaker.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ delay: idx * 0.05 }}
                className="min-w-[300px] md:min-w-[360px] snap-center border border-white/5 bg-charcoal/60 backdrop-blur-sm overflow-hidden group"
              >
                <div className="relative h-[420px] overflow-hidden">
                  <SmartImage
                    src={speaker.image}
                    fallbackSrc={portraitFallback}
                    alt={speaker.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {typeof speaker.year === 'number' && (
                    <div className="absolute top-5 left-5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 text-[10px] tracking-[0.3em] uppercase text-gold-300">
                      {speaker.year}
                    </div>
                  )}
                </div>
                <div className="p-10">
                  <div className="text-gold-500 text-[10px] uppercase tracking-[0.3em] mb-3 font-semibold">Topic</div>
                  <h3 className="font-serif text-xl text-white leading-snug mb-4">{speaker.topic}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 font-light italic">“{speaker.quote}”</p>
                  <div className="border-t border-white/5 pt-6 flex items-center justify-between">
                    <div className="text-white font-display tracking-wider">{speaker.name}</div>
                    <div className="text-gold-500 text-xs">✦</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      <Section background="pattern">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="p-12 border border-white/5 bg-obsidian relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-900/10 via-transparent to-transparent" />
            <div className="relative z-10">
              <div className="text-gold-500 text-[10px] uppercase tracking-[0.3em] mb-4 font-semibold">{ls.participateTitle}</div>
              <h3 className="font-serif text-3xl text-white mb-6 leading-tight">Become a Participant</h3>
              <p className="text-gray-400 leading-loose font-light mb-10">{ls.participateSubtitle}</p>
              <Link to="/contact">
                <Button className="w-full md:w-auto">{ls.participateButtonLabel}</Button>
              </Link>
            </div>
          </div>

          <div className="p-12 border border-white/5 bg-obsidian relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-900/10 via-transparent to-transparent" />
            <div className="relative z-10">
              <div className="text-gold-500 text-[10px] uppercase tracking-[0.3em] mb-4 font-semibold">{ls.sponsorTitle}</div>
              <h3 className="font-serif text-3xl text-white mb-6 leading-tight">{ls.sponsorSubtitle}</h3>
              <div className="text-gray-300 text-[10px] uppercase tracking-[0.3em] mb-6 font-semibold opacity-70">{ls.sponsorBenefitsTitle}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {ls.sponsorBenefits.map((b, idx) => (
                  <div key={idx} className="border border-white/5 bg-charcoal/40 p-6">
                    <div className="text-white font-semibold mb-2">{b.title}</div>
                    <div className="text-gray-500 text-sm leading-relaxed font-light">{b.description}</div>
                  </div>
                ))}
              </div>
              <Link to="/sponsors?section=inquire">
                <Button variant="outline" className="w-full md:w-auto">{ls.sponsorButtonLabel}</Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
};


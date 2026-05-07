import React, { useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { useSiteContent } from '../components/SiteContentProvider';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountUp } from '../components/ui/CountUp';

export const About: React.FC = () => {
  const { content } = useSiteContent();
  const about = content.about;
  const [tab, setTab] = useState<'mission' | 'vision' | 'values'>('mission');

  const heroFallback = useMemo(() => placeholderImageDataUri({ width: 1920, height: 1080, label: about.title }), [about.title]);

  return (
    <>
      <div className="pt-36 pb-20 bg-obsidian border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0">
          <SmartImage
            src={about.heroImage}
            fallbackSrc={heroFallback}
            alt={about.title}
            className="w-full h-full object-cover opacity-25 grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-obsidian/40 to-obsidian" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <div className="text-gold-500 text-[10px] uppercase tracking-[0.35em] font-semibold mb-6">Institution</div>
            <h1 className="font-display text-5xl md:text-7xl text-white mb-6 leading-tight">{about.title}</h1>
            <p className="text-gray-400 text-lg md:text-xl font-light leading-relaxed font-serif italic">{about.subtitle}</p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/lecture-series">
                <Button>Explore The Lecture Series</Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline">Contact</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Section background="pattern">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7">
              <div className="border border-white/5 bg-charcoal/50 backdrop-blur-sm p-10">
                <div className="flex gap-2 border border-white/5 bg-black/30 p-1 rounded-full w-fit">
                  <button
                    className={`px-6 py-2 text-[10px] uppercase tracking-[0.25em] rounded-full transition-colors ${
                      tab === 'mission' ? 'text-obsidian bg-gold-500' : 'text-gray-400 hover:text-gold-300'
                    }`}
                    onClick={() => setTab('mission')}
                  >
                    Mission
                  </button>
                  <button
                    className={`px-6 py-2 text-[10px] uppercase tracking-[0.25em] rounded-full transition-colors ${
                      tab === 'vision' ? 'text-obsidian bg-gold-500' : 'text-gray-400 hover:text-gold-300'
                    }`}
                    onClick={() => setTab('vision')}
                  >
                    Vision
                  </button>
                  <button
                    className={`px-6 py-2 text-[10px] uppercase tracking-[0.25em] rounded-full transition-colors ${
                      tab === 'values' ? 'text-obsidian bg-gold-500' : 'text-gray-400 hover:text-gold-300'
                    }`}
                    onClick={() => setTab('values')}
                  >
                    Values
                  </button>
                </div>

                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="mt-10"
                >
                  <h2 className="font-serif text-3xl text-white mb-6">
                    {tab === 'mission' ? about.missionTitle : tab === 'vision' ? about.visionTitle : about.coreValuesTitle}
                  </h2>
                  <p className="text-gray-300 leading-loose font-light text-lg">
                    {tab === 'mission' ? about.missionBody : tab === 'vision' ? about.visionBody : about.coreValuesBody}
                  </p>
                </motion.div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-4">
                {about.stats.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-15%' }}
                    transition={{ delay: idx * 0.05 }}
                    className="border border-white/5 bg-obsidian/60 p-8"
                  >
                    <div className="text-gold-300 font-display text-3xl md:text-4xl mb-3">
                      <CountUp value={s.value} suffix={s.suffix} />
                    </div>
                    <div className="text-gray-500 text-[10px] uppercase tracking-[0.25em]">{s.label}</div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 border border-white/5 bg-black/30 p-8">
                <div className="text-white font-semibold mb-3">Institutional Standards</div>
                <div className="text-gray-500 text-sm leading-loose font-light">
                  Adhering to the highest standards of cultural protocol and academic rigour, the Colloquium serves as a premier gathering for thought leaders.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section background="darker">
        <div className="max-w-6xl mx-auto mb-20">
          <div className="text-center mb-16">
            <div className="text-gold-500 text-[10px] uppercase tracking-[0.35em] font-semibold mb-4">{about.leadershipTitle || 'Leadership'}</div>
            <h2 className="font-display text-4xl md:text-5xl text-white">Governing Council & Management</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {about.leadership && about.leadership.map((member) => (
              <div key={member.id} className="group border border-white/5 bg-charcoal/30 hover:bg-charcoal/50 transition-colors p-6 text-center">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-2 border-gold-500/20 group-hover:border-gold-500/50 transition-colors">
                  <SmartImage
                    src={member.image || ''}
                    fallbackSrc={placeholderImageDataUri({ width: 400, height: 400, label: member.name[0] })}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-white font-serif text-xl mb-1">{member.name}</h3>
                <div className="text-gold-500 text-xs uppercase tracking-widest mb-3">{member.title}</div>
                <div className="text-gray-400 text-sm font-light mb-4">{member.role}</div>
                {member.email && (
                  <div className="text-gray-500 text-xs">
                    <a href={`mailto:${member.email}`} className="hover:text-gold-400 transition-colors">{member.email}</a>
                  </div>
                )}
                {member.phone && (
                  <div className="text-gray-500 text-xs mt-1">{member.phone}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-6 flex-col md:flex-row mb-12">
            <div>
              <div className="text-gold-500 text-[10px] uppercase tracking-[0.35em] font-semibold mb-4">{about.programsTitle}</div>
              <h2 className="font-display text-4xl md:text-5xl text-white mb-4">A Living Institution</h2>
              <p className="text-gray-400 max-w-3xl font-light leading-relaxed">{about.programsSubtitle}</p>
            </div>
            <Link to="/sponsors">
              <Button variant="outline">Become a Patron</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {about.programs.map((p, idx) => (
              <motion.details
                key={p.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ delay: idx * 0.03 }}
                className="group border border-white/5 bg-charcoal/40 backdrop-blur-sm p-8 open:border-gold-500/30"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-6">
                  <div className="text-white font-serif text-lg leading-snug">{p.title}</div>
                  <div className="text-gold-500 text-xs opacity-70 group-open:opacity-100 transition-opacity">▼</div>
                </summary>
                <div className="mt-5 text-gray-500 text-sm leading-loose font-light">
                  Curated for impact—structured planning, premium guest experience, and an outcomes-driven approach to heritage, education,
                  and cultural diplomacy.
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
};


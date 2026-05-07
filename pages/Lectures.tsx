import React from 'react';
import { Section } from '../components/Section';
import { motion } from 'framer-motion';
import { useSiteContent } from '../components/SiteContentProvider';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';

export const Lectures: React.FC = () => {
  const { content } = useSiteContent();
  const page = content.lecturesPage;

  return (
    <>
      <div className="pt-32 pb-16 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6">
          <h1 className="font-display text-5xl text-white mb-6">{page.title}</h1>
          <p className="text-gray-400 max-w-2xl text-lg font-serif italic">{page.subtitle}</p>
        </div>
      </div>

      <Section background="pattern">
        <div className="space-y-24">
          {content.lectures.map((lecture, index) => (
            <motion.div 
              id={lecture.id}
              key={lecture.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: index * 0.1 }}
              className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-12 items-center`}
            >
              {/* Image Side */}
              <div className="w-full md:w-1/2 relative group">
                <div className={`absolute top-4 ${index % 2 === 0 ? 'left-4' : 'right-4'} w-full h-full border border-gold-500/30 z-0 transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2`} />
                <div className="relative z-10 overflow-hidden">
                  <SmartImage
                    src={lecture.image}
                    fallbackSrc={placeholderImageDataUri({ width: 1400, height: 1050, label: 'Lecture Portrait' })}
                    alt={lecture.speaker} 
                    className="w-full aspect-[4/3] object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 bg-gold-500 text-obsidian px-4 py-2 font-mono text-sm font-bold">
                    {lecture.year}
                  </div>
                </div>
              </div>

              {/* Text Side */}
              <div className="w-full md:w-1/2">
                <div className="mb-4">
                  <span className="text-gold-500 tracking-widest text-xs uppercase block mb-1">Theme</span>
                  <span className="text-white text-lg font-serif">{lecture.theme}</span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-display text-white mb-4 leading-tight">
                  {lecture.title}
                </h2>
                
                <div className="mb-6 pl-4 border-l border-gold-500/50">
                  <p className="text-xl text-white font-serif">{lecture.speaker}</p>
                  <p className="text-gray-500 text-sm">{lecture.role}</p>
                </div>

                <p className="text-gray-400 leading-relaxed mb-6">
                  {lecture.description}
                </p>

                <div className="flex gap-4">
                  {lecture.pdfUrl && (
                    <a
                      href={lecture.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-500 text-xs uppercase tracking-widest hover:text-white transition-colors border-b border-transparent hover:border-gold-500 pb-1"
                    >
                      Download Paper (PDF)
                    </a>
                  )}
                  {lecture.recordingUrl && (
                    <a
                      href={lecture.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-500 text-xs uppercase tracking-widest hover:text-white transition-colors border-b border-transparent hover:border-gold-500 pb-1"
                    >
                      Watch Recording
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>
      
      {/* FAQ / Info Section */}
      <Section background="darker">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
                <h3 className="font-serif text-2xl text-white mb-4">{page.nominationTitle}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">{page.nominationBody}</p>
                <button className="text-gold-500 text-xs underline">{page.nominationLinkLabel}</button>
            </div>
            <div>
                <h3 className="font-serif text-2xl text-white mb-4">{page.venueTitle}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">{page.venueBody}</p>
                <button className="text-gold-500 text-xs underline">{page.venueLinkLabel}</button>
            </div>
        </div>
      </Section>
    </>
  );
};

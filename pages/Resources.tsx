import React from 'react';
import { Section } from '../components/Section';
import { UploadWidget } from '../components/ui/UploadWidget';
import { motion } from 'framer-motion';
import { useSiteContent } from '../components/SiteContentProvider';

export const Resources: React.FC = () => {
  const { content } = useSiteContent();

  return (
    <>
      <div className="pt-40 pb-20 bg-obsidian border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold-900/10 via-obsidian to-obsidian" />
        <div className="container mx-auto px-6 relative z-10">
          <span className="text-gold-500 text-xs tracking-[0.3em] uppercase mb-4 block">{content.resourcesPage.heroKicker}</span>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-8">{content.resourcesPage.heroTitle}</h1>
          <p className="text-gray-400 max-w-2xl text-lg font-serif italic border-l-2 border-gold-500/30 pl-6">
            {content.resourcesPage.heroQuote}
          </p>
        </div>
      </div>

      {/* Downloads Section */}
      <Section background="pattern">
        <div className="mb-16 flex items-end justify-between">
          <div>
            <h2 className="text-gold-500 text-[10px] uppercase tracking-[0.25em] mb-4 font-semibold">{content.resourcesPage.downloadsKicker}</h2>
            <h3 className="font-serif text-4xl text-white">{content.resourcesPage.downloadsTitle}</h3>
          </div>
          <div className="hidden md:block h-[1px] bg-white/10 w-1/3 mb-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {content.downloads.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-charcoal/40 backdrop-blur-sm border border-white/5 p-8 group hover:border-gold-500/30 transition-all duration-500 flex flex-col justify-between hover:-translate-y-1 hover:shadow-2xl hover:shadow-black"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <span className={`text-[9px] uppercase tracking-widest px-3 py-1 border ${
                    item.category === 'Academic' ? 'border-white/20 text-gray-300' :
                    item.category === 'Press' ? 'border-gold-500/30 text-gold-400' :
                    'border-gray-800 text-gray-500'
                  }`}>
                    {item.category}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[9px] text-gray-600 uppercase mb-1">Format</span>
                    <span className="font-mono text-xs text-gold-600">{item.type}</span>
                  </div>
                </div>
                <h4 className="font-display text-xl text-white mb-4 leading-snug group-hover:text-gold-400 transition-colors">
                  {item.title}
                </h4>
                <div className="w-8 h-[1px] bg-white/20 mt-4 mb-4 group-hover:w-full group-hover:bg-gold-500/50 transition-all duration-700 ease-out" />
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <span className="text-[10px] text-gray-500 font-mono tracking-widest">{item.size}</span>
                {typeof item.url === 'string' && item.url.trim() ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 text-[10px] text-white hover:text-gold-500 transition-colors uppercase tracking-[0.2em] font-semibold group/btn"
                  >
                    <span>Download</span>
                    <div className="p-1.5 rounded-full border border-white/20 group-hover/btn:border-gold-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 9.75V1.5m0 0l3 3m-3-3l-3 3" />
                      </svg>
                    </div>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-3 text-[10px] text-white/40 cursor-not-allowed uppercase tracking-[0.2em] font-semibold"
                  >
                    <span>Download</span>
                    <div className="p-1.5 rounded-full border border-white/10 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 9.75V1.5m0 0l3 3m-3-3l-3 3" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Uploads Section */}
      <Section background="darker">
        <div className="mb-16">
          <h2 className="text-gold-500 text-[10px] uppercase tracking-[0.25em] mb-4 font-semibold">{content.resourcesPage.uploadsKicker}</h2>
          <h3 className="font-serif text-4xl text-white">{content.resourcesPage.uploadsTitle}</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <UploadWidget 
            title="Academic Abstract" 
            description="Submit abstracts or manuscripts for the Academic Council review. Secure channel."
            accept=".pdf,.doc,.docx"
            s3BucketName="heritage-papers-secure"
          />
          
          <UploadWidget 
            title="Press Media Ingest" 
            description="High-fidelity upload for accredited media partners. Auto-chunking enabled for large video files."
            accept="image/*,video/*,.zip"
            s3BucketName="heritage-media-ingest"
          />
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-4 text-gray-600 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[10px] uppercase tracking-widest">
                256-Bit SSL Encrypted Transmission
            </p>
        </div>
      </Section>
    </>
  );
};

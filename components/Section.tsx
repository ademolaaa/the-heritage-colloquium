import React from 'react';
import { motion } from 'framer-motion';
import { useSiteContent } from './SiteContentProvider';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  background?: 'default' | 'pattern' | 'darker';
}

export const Section: React.FC<SectionProps> = ({ 
  children, 
  className = '', 
  id = '', 
  background = 'default' 
}) => {
  const { content } = useSiteContent();
  const hasGlobalBg = content.globalBackground?.type && content.globalBackground.type !== 'none';

  const bgClasses = {
    default: hasGlobalBg ? 'bg-obsidian/90 backdrop-blur-sm' : 'bg-obsidian',
    pattern: hasGlobalBg ? 'bg-obsidian/90 bg-pattern-subtle bg-fixed backdrop-blur-sm' : 'bg-obsidian bg-pattern-subtle bg-fixed',
    darker: hasGlobalBg ? 'bg-black/90 backdrop-blur-sm' : 'bg-black',
  };

  return (
    <section id={id} className={`py-24 relative overflow-hidden ${bgClasses[background]} ${className}`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold-900/60 to-transparent opacity-60" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-60" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="container mx-auto px-6 relative z-10"
      >
        {children}
      </motion.div>
    </section>
  );
};

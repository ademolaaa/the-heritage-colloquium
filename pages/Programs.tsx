import React from 'react';
import { Section } from '../components/Section';
import { PROGRAM_CATEGORIES, categoryTitle } from '../lib/categories';
import { useNavigate } from 'react-router-dom';

export const Programs: React.FC = () => {
  const navigate = useNavigate();
  const programs = PROGRAM_CATEGORIES;

  return (
    <>
      <Section background="darker" className="pt-40 pb-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="font-display text-5xl md:text-7xl text-white mb-6">
            Programs & <span className="text-gold-500">Pillars</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
            Explore the diverse cultural and intellectual initiatives of the Ahiajoku Centre.
          </p>
        </div>
      </Section>

      <Section background="pattern" className="py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {programs.map((program, idx) => (
              <div 
                key={program}
                className="group relative border border-white/10 bg-charcoal/50 p-8 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/gallery?category=${encodeURIComponent(program)}`)}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 font-display text-6xl text-white group-hover:opacity-20 transition-opacity">
                  {idx + 1}
                </div>
                <h3 className="font-display text-2xl text-white mb-4 pr-12 group-hover:text-gold-500 transition-colors break-words leading-tight">
                  {categoryTitle(program)}
                </h3>
                <div className="text-sm text-gray-400 font-light mb-6">
                  Explore media, documents, and archives related to this pillar.
                </div>
                <div className="flex gap-4">
                  <button className="text-xs uppercase tracking-widest text-gold-500 hover:text-white transition-colors">
                    View Gallery →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
};

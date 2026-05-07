import React, { useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { useSiteContent } from '../components/SiteContentProvider';

export const Sponsors: React.FC = () => {
  const { content } = useSiteContent();
  const page = content.sponsorsPage;
  const tierNameById = useMemo(() => {
    const map = new Map<string, string>();
    content.sponsorTiers.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [content.sponsorTiers]);

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    organization: '',
    tier: 'gold',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const tierLabel = tierNameById.get(formState.tier) || formState.tier;
    const subject = `Sponsorship Inquiry — ${tierLabel}`;
    const body = [
      `Name: ${formState.name}`,
      `Email: ${formState.email}`,
      `Organization: ${formState.organization || '-'}`,
      `Tier Interest: ${tierLabel}`,
      '',
      'Message / Intent:',
      formState.message || '-',
    ].join('\n');

    const to = content.contact.email || 'secretariat@ahiajoku.im.gov.ng';
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;

    setIsSubmitting(false);
    setFormState({ name: '', email: '', organization: '', tier: 'gold', message: '' });
  };

  return (
    <>
      <div className="pt-40 pb-20 bg-obsidian border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-charcoal to-transparent opacity-50" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <span className="text-gold-500 text-xs tracking-[0.4em] uppercase mb-6 block font-semibold">{page.heroKicker}</span>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-8">{page.heroTitle}</h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg font-serif italic">{page.heroSubtitle}</p>
        </div>
      </div>

      <Section>
        {page.currentSponsorsList && page.currentSponsorsList.length > 0 && (
          <div className="mb-20 text-center">
            <div className="text-gold-500 text-[10px] uppercase tracking-[0.35em] font-semibold mb-8">
              {page.currentSponsorsTitle || 'Our Partners'}
            </div>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-80">
              {page.currentSponsorsList.map((sponsor, idx) => (
                <div key={idx} className="text-white font-display text-2xl md:text-3xl tracking-wide border-b border-transparent hover:border-gold-500/50 transition-colors pb-1">
                  {sponsor}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {content.sponsorTiers.map((tier) => (
            <div 
              key={tier.id} 
              className={`p-10 border transition-all duration-500 relative group flex flex-col min-h-[500px] ${
                tier.id === 'platinum' 
                  ? 'bg-charcoal border-gold-500/50 -translate-y-6 shadow-[0_20px_50px_-12px_rgba(212,175,55,0.1)]' 
                  : 'bg-obsidian border-white/5 hover:border-gold-500/20 hover:-translate-y-2'
              }`}
            >
              {tier.id === 'platinum' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-gold-400 to-gold-600 text-black px-6 py-1.5 text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg shadow-gold-500/20">
                  {page.sovereignTierLabel}
                </div>
              )}
              
              <div className="mb-8 text-center">
                <h3 className={`text-2xl font-display mb-4 ${tier.id === 'platinum' ? 'text-gold-400' : 'text-white'}`}>
                  {tier.name}
                </h3>
                <div className="inline-block border-y border-white/10 py-2 px-4">
                    <div className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                    {tier.priceRange}
                    </div>
                </div>
              </div>
              
              <ul className="space-y-6 mb-12 flex-grow">
                {tier.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                    <span className="text-gold-500 mr-4 text-xs mt-0.5">✦</span>
                    <span className="leading-relaxed font-light">{benefit}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.id === 'platinum' ? 'primary' : 'outline'}
                className="w-full"
                onClick={() => {
                  setFormState((s) => ({ ...s, tier: tier.id }));
                  document.getElementById('inquire')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Select {tier.name}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section background="darker" id="inquire" className="relative">
        {/* Background Accent */}
        <div className="absolute left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-charcoal/50 to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 border border-white/5 bg-obsidian shadow-2xl">
            {/* Form Header Side */}
            <div className="md:col-span-2 bg-charcoal p-12 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-pattern-subtle opacity-30" />
                <h2 className="font-serif text-4xl text-white mb-6 relative z-10">{page.inquiryTitle}</h2>
                <p className="text-gray-500 text-sm leading-loose relative z-10">{page.inquiryBody}</p>
            </div>

            {/* Form Inputs Side */}
            <div className="md:col-span-3 p-12 bg-obsidian">
                <form onSubmit={handleSubmit} className="relative">
                    {isSubmitting && (
                    <div className="absolute inset-0 bg-obsidian/90 backdrop-blur-sm z-20 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                            <div className="text-gold-500 text-[10px] uppercase tracking-widest">Processing Request</div>
                        </div>
                    </div>
                    )}

                    <div className="grid grid-cols-1 gap-8 mb-8">
                    <div className="group">
                        <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-gold-500 transition-colors">Full Name</label>
                        <input 
                        type="text" 
                        required
                        className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:border-gold-500 focus:outline-none transition-all placeholder:text-white/10 font-serif text-lg"
                        placeholder="Hon. John Doe"
                        value={formState.name}
                        onChange={e => setFormState({...formState, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="group">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-gold-500 transition-colors">Email Address</label>
                            <input 
                            type="email" 
                            required
                            className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:border-gold-500 focus:outline-none transition-all placeholder:text-white/10 font-serif"
                            placeholder="john@organization.com"
                            value={formState.email}
                            onChange={e => setFormState({...formState, email: e.target.value})}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-gold-500 transition-colors">Organization</label>
                            <input 
                            type="text" 
                            className="w-full bg-black/50 border-b border-white/10 py-3 px-4 text-white focus:border-gold-500 focus:outline-none transition-all placeholder:text-white/50 font-serif"
                            placeholder="Foundation Name"
                            value={formState.organization}
                            onChange={e => setFormState({...formState, organization: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="group">
                            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-gold-500 transition-colors">Tier Interest</label>
                            <div className="relative">
                                <select 
                                className="w-full bg-black/50 border-b border-white/10 py-3 px-4 text-white focus:border-gold-500 focus:outline-none transition-all appearance-none font-serif cursor-pointer"
                                value={formState.tier}
                                onChange={e => setFormState({...formState, tier: e.target.value})}
                                >
                                {content.sponsorTiers.map(t => <option key={t.id} value={t.id} className="bg-charcoal">{t.name}</option>)}
                                </select>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
                            </div>
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-gold-500 transition-colors">Message / Intent</label>
                        <textarea 
                        rows={3}
                        className="w-full bg-black/50 border-b border-white/10 py-3 px-4 text-white focus:border-gold-500 focus:outline-none transition-all placeholder:text-white/50 font-serif resize-none"
                        placeholder="Briefly describe your partnership goals..."
                        value={formState.message}
                        onChange={e => setFormState({...formState, message: e.target.value})}
                        />
                    </div>
                    </div>

                    <div className="mt-10">
                    <Button type="submit" disabled={isSubmitting} className="w-full">{page.inquirySubmitLabel}</Button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
};

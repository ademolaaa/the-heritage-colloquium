import React, { useMemo, useState } from 'react';
import { Section } from '../components/Section';
import { Button } from '../components/ui/Button';
import { UploadWidget } from '../components/ui/UploadWidget';
import { useSiteContent } from '../components/SiteContentProvider';

export const Contact: React.FC = () => {
  const { content } = useSiteContent();
  const [subject, setSubject] = useState('General Inquiry');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const to = useMemo(() => content.contact.email || 'secretariat@ahiajoku.im.gov.ng', [content.contact.email]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailSubject = `${subject} — ${name || 'Website Visitor'}`;
    const body = [`Name: ${name || '-'}`, `Email: ${email || '-'}`, '', message || '-'].join('\n');
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <>
      <div className="pt-32 pb-16 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6">
          <h1 className="font-display text-5xl text-white mb-6">{content.contactPage.heroTitle}</h1>
          <p className="text-gray-400 max-w-2xl text-lg font-serif">
            {content.contactPage.heroSubtitle}
          </p>
        </div>
      </div>

      <Section background="pattern">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          
          {/* Info Side */}
          <div>
            <div className="mb-12">
              <h3 className="text-gold-500 text-xs uppercase tracking-widest mb-4">{content.contactPage.addressHeading}</h3>
              <p className="text-white text-lg font-serif leading-relaxed whitespace-pre-line">
                {content.contact.address}
              </p>
            </div>

            <div className="mb-12">
              <h3 className="text-gold-500 text-xs uppercase tracking-widest mb-4">{content.contactPage.linesHeading}</h3>
              <p className="text-gray-400 mb-2">Protocol: <span className="text-white">{content.contact.phone}</span></p>
              <p className="text-gray-400">Media: <span className="text-white">{content.contact.email}</span></p>
            </div>

            {/* Reusable Upload Widget */}
            <UploadWidget 
              title={content.contactPage.uploadTitle} 
              description={content.contactPage.uploadDescription}
              accept="image/*,video/*"
            />
          </div>

          {/* Form Side */}
          <div className="bg-charcoal p-10 border-t-4 border-gold-500">
            <h3 className="font-display text-2xl text-white mb-8">{content.contactPage.formTitle}</h3>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <label className="block text-gray-500 text-xs uppercase tracking-widest mb-2">Subject</label>
                <select
                  className="w-full bg-obsidian border-b border-white/10 text-white py-2 focus:border-gold-500 focus:outline-none transition-colors"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option>General Inquiry</option>
                  <option>Press Accreditation</option>
                  <option>Speaker Proposal</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 text-xs uppercase tracking-widest mb-2">Name</label>
                <input
                  type="text"
                  className="w-full bg-obsidian border-b border-white/10 text-white py-2 focus:border-gold-500 focus:outline-none transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs uppercase tracking-widest mb-2">Email</label>
                <input
                  type="email"
                  className="w-full bg-obsidian border-b border-white/10 text-white py-2 focus:border-gold-500 focus:outline-none transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs uppercase tracking-widest mb-2">Message</label>
                <textarea
                  rows={4}
                  className="w-full bg-black/50 border-b border-white/10 text-white py-2 px-4 focus:border-gold-500 focus:outline-none transition-colors placeholder:text-white/50"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <Button className="w-full mt-4" type="submit">
                {content.contactPage.submitLabel}
              </Button>
            </form>
          </div>
        </div>
      </Section>
    </>
  );
};

import React from 'react';
import { Section } from '../components/Section';
import { useSiteContent } from '../components/SiteContentProvider';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const Blog: React.FC = () => {
  const { content } = useSiteContent();
  const posts = content.blogPosts || [];

  return (
    <>
      <div className="pt-40 pb-20 bg-obsidian border-b border-white/5">
        <div className="container mx-auto px-6 text-center">
          <span className="text-gold-500 text-xs tracking-[0.4em] uppercase mb-6 block font-semibold">Updates</span>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-8">Blog & Insights</h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg font-serif italic">
            "Documenting our journey, sharing our stories, and celebrating our heritage."
          </p>
        </div>
      </div>

      <Section background="pattern">
        <div className="max-w-6xl mx-auto">
          {posts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p>No blog posts available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link to={`/blog/${post.slug}`} key={post.id} className="group block h-full">
                  <div className="border border-white/5 bg-charcoal/30 h-full flex flex-col transition-all duration-300 hover:border-gold-500/30 hover:bg-charcoal/50">
                    <div className="aspect-video overflow-hidden border-b border-white/5">
                      <SmartImage
                        src={post.image || ''}
                        fallbackSrc={placeholderImageDataUri({ width: 600, height: 400, label: post.title })}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                      <div className="flex items-center justify-between mb-4 text-xs">
                        <span className="text-gold-500 uppercase tracking-widest">{post.category || 'Blog'}</span>
                        <span className="text-gray-500">{post.date}</span>
                      </div>
                      <h2 className="text-white font-serif text-2xl mb-3 group-hover:text-gold-400 transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3 flex-grow">
                        {post.excerpt}
                      </p>
                      <div className="text-gold-500 text-xs uppercase tracking-widest flex items-center gap-2">
                        Read More <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Section>
    </>
  );
};

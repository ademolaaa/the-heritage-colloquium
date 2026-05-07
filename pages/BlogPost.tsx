import React, { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Section } from '../components/Section';
import { useSiteContent } from '../components/SiteContentProvider';
import { SmartImage } from '../components/ui/SmartImage';
import { placeholderImageDataUri } from '../lib/placeholders';
import { Button } from '../components/ui/Button';

export const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { content } = useSiteContent();
  
  const post = useMemo(() => {
    return content.blogPosts?.find(p => p.slug === slug);
  }, [content.blogPosts, slug]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <>
      <div className="pt-32 pb-12 bg-obsidian border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-obsidian z-10" />
        <div className="absolute inset-0 opacity-20">
             <SmartImage
                src={post.image || ''}
                fallbackSrc={placeholderImageDataUri({ width: 1920, height: 1080, label: post.title })}
                alt={post.title}
                className="w-full h-full object-cover blur-sm"
              />
        </div>

        <div className="container mx-auto px-6 relative z-20">
            <Link to="/blog">
                <Button variant="outline" className="mb-8 border-white/10 text-white/60 hover:text-white hover:border-gold-500">
                    ← Back to Blog
                </Button>
            </Link>
            
            <div className="max-w-4xl">
                <div className="flex items-center gap-4 text-xs tracking-widest uppercase mb-4 text-gold-500">
                    <span>{post.category || 'Blog'}</span>
                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                    <span className="text-gray-400">{post.date}</span>
                </div>
                <h1 className="font-display text-4xl md:text-6xl text-white mb-6 leading-tight">{post.title}</h1>
                <p className="text-xl text-gray-300 font-serif italic max-w-2xl">{post.excerpt}</p>
            </div>
        </div>
      </div>

      <Section background="pattern">
        <div className="max-w-4xl mx-auto">
            <div className="bg-charcoal/30 border border-white/5 p-8 md:p-12">
                {post.image && (
                    <div className="mb-12 border border-white/5">
                        <SmartImage
                            src={post.image}
                            fallbackSrc={placeholderImageDataUri({ width: 1200, height: 600, label: post.title })}
                            alt={post.title}
                            className="w-full aspect-video object-cover"
                        />
                    </div>
                )}
                
                <article className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:text-gold-500 prose-p:font-light prose-p:leading-loose prose-a:text-gold-400">
                    {/* Ideally this would be a Markdown renderer, but for now we render text with line breaks */}
                    {post.content.split('\n').map((paragraph, idx) => (
                        paragraph ? <p key={idx}>{paragraph}</p> : <br key={idx} />
                    ))}
                </article>

                <div className="mt-12 pt-12 border-t border-white/5 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        Posted by <span className="text-gold-500">{post.author}</span>
                    </div>
                    
                    {post.tags && post.tags.length > 0 && (
                        <div className="flex gap-2">
                            {post.tags.map(tag => (
                                <span key={tag} className="text-xs bg-white/5 px-3 py-1 text-gray-400 rounded-full border border-white/5">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </Section>
    </>
  );
};

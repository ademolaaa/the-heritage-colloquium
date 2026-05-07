export interface Lecture {
  id: string;
  year: number;
  theme: string;
  speaker: string;
  title: string;
  description: string;
  image: string;
  role: string;
  pdfUrl?: string;
  recordingUrl?: string;
}

export interface SponsorTier {
  id: string;
  name: string;
  priceRange: string;
  benefits: string[];
}

export interface NavItem {
  label: string;
  path: string;
  hidden?: boolean;
}

export interface Announcement {
  id: string;
  date: string;
  title: string;
  excerpt: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  size: string;
  type: string;
  category: 'General' | 'Press' | 'Academic';
  url?: string;
}

export interface PastSpeaker {
  id: string;
  name: string;
  topic: string;
  quote: string;
  image: string;
  year?: number;
}

export interface LectureSeriesContent {
  title: string;
  subtitle: string;
  briefHistoryTitle: string;
  briefHistoryBullets: string[];
  pastSpeakersTitle: string;
  pastSpeakersSubtitle: string;
  pastSpeakers: PastSpeaker[];
  participateTitle: string;
  participateSubtitle: string;
  participateButtonLabel: string;
  sponsorTitle: string;
  sponsorSubtitle: string;
  sponsorBenefitsTitle: string;
  sponsorBenefits: { title: string; description: string }[];
  sponsorButtonLabel: string;
}

export interface HomeContent {
  heroKicker: string;
  heroBackgroundImage: string;
  heroBackgroundAlt: string;
  heroTitleLine1: string;
  heroTitleEmphasis: string;
  heroQuote: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaTo: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaTo: string;
  mandateTitle: string;
  mandateParagraph1: string;
  mandateParagraph2: string;
  mandateImage: string;
  keynoteLabel: string;
  announcementsTitle: string;
  announcementsCtaLabel: string;
  socialFeedTitle?: string;
  socialFeedSubtitle?: string;
  socialFeedEmbedCode?: string;
}

export interface LecturesPageContent {
  title: string;
  subtitle: string;
  nominationTitle: string;
  nominationBody: string;
  nominationLinkLabel: string;
  venueTitle: string;
  venueBody: string;
  venueLinkLabel: string;
}

export interface SponsorsPageContent {
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  sovereignTierLabel: string;
  inquiryTitle: string;
  inquiryBody: string;
  inquirySubmitLabel: string;
  currentSponsorsTitle?: string;
  currentSponsorsList?: string[];
}

export interface StatItem {
  id: string;
  value: number;
  label: string;
  suffix?: string;
}

export interface LeadershipMember {
  id: string;
  name: string;
  title: string;
  role: string;
  email?: string;
  phone?: string;
  image?: string;
}

export interface AboutContent {
  title: string;
  subtitle: string;
  missionTitle: string;
  missionBody: string;
  visionTitle: string;
  visionBody: string;
  coreValuesTitle: string;
  coreValuesBody: string;
  programsTitle: string;
  programsSubtitle: string;
  programs: { id: string; title: string }[];
  stats: StatItem[];
  heroImage: string;
  leadershipTitle?: string;
  leadership: LeadershipMember[];
}

export interface SiteBrand {
  wordmark: string;
  tagline: string;
  logoUrl: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // HTML or Markdown content
  author: string;
  date: string;
  image?: string;
  category?: string;
  tags?: string[];
}

export interface GlobalBackground {
  type: 'none' | 'image' | 'video';
  imageUrl: string;
  videoUrl: string;
  opacity: number; // 0 to 1
}

export interface SocialLinks {
  twitter: string;
  linkedin: string;
  instagram: string;
}

export interface FooterContent {
  description: string;
  credit: string;
}

export interface ResourcesPageContent {
  heroKicker: string;
  heroTitle: string;
  heroQuote: string;
  downloadsKicker: string;
  downloadsTitle: string;
  uploadsKicker: string;
  uploadsTitle: string;
}

export interface ContactPageContent {
  heroTitle: string;
  heroSubtitle: string;
  addressHeading: string;
  linesHeading: string;
  uploadTitle: string;
  uploadDescription: string;
  formTitle: string;
  submitLabel: string;
}

import { MediaCategory } from './lib/categories';

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  title: string;
  description?: string;
  category?: MediaCategory;
  url: string;
  filePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  relatedLectureId?: string;
  relatedEventId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  year?: number;
  eventId?: string;
  mediaIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteContent {
  globalBackground?: GlobalBackground;
  brand: SiteBrand;
  social: SocialLinks;
  footer: FooterContent;
  nav: NavItem[];
  footerNav: NavItem[];
  home: HomeContent;
  about: AboutContent;
  lectureSeries: LectureSeriesContent;
  resourcesPage: ResourcesPageContent;
  contactPage: ContactPageContent;
  lecturesPage: LecturesPageContent;
  sponsorsPage: SponsorsPageContent;
  lectures: Lecture[];
  sponsorTiers: SponsorTier[];
  announcements: Announcement[];
  blogPosts: BlogPost[];
  downloads: DownloadItem[];
  contact: {
    email: string;
    phone: string;
    address: string;
  };
}

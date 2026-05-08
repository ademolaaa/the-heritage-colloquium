import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SiteContentProvider } from './components/SiteContentProvider';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { LectureSeries } from './pages/LectureSeries';
import { Lectures } from './pages/Lectures';
import { Sponsors } from './pages/Sponsors';
import { Contact } from './pages/Contact';
import { Resources } from './pages/Resources';
import { Blog } from './pages/Blog';
import { BlogPost } from './pages/BlogPost';
import { Gallery } from './pages/Gallery';
import { Programs } from './pages/Programs';
import { Admin } from './pages/Admin';
import { AdminGallery } from './pages/AdminGallery';
import { AdminUploads } from './pages/AdminUploads';
import { SocialFeed } from './components/social/Feed';
import { AskAhiajoku } from './components/qa/AskAhiajoku';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { MediaLibrary } from './pages/MediaLibrary';

function App() {
  return (
    <SiteContentProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="lecture-series" element={<LectureSeries />} />
              <Route path="lectures" element={<Lectures />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="programs" element={<Programs />} />
              <Route path="sponsors" element={<Sponsors />} />
              <Route path="resources" element={<Resources />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<BlogPost />} />
              <Route path="feed" element={<SocialFeed />} />
              <Route path="ask" element={<AskAhiajoku />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="contact" element={<Contact />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="profile" element={<Profile />} />
              <Route path="admin">
                <Route index element={<Navigate to="console" replace />} />
                <Route path="console" element={<Admin />} />
                <Route path="gallery" element={<AdminGallery />} />
                <Route path="uploads" element={<AdminUploads />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </SiteContentProvider>
  );
}

export default App;

import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import BetaStage1Gate from '@/components/beta/BetaStage1Gate';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import Home from '@/pages/Home';
import EventDetail from '@/pages/EventDetail';
import PostEvent from '@/pages/PostEvent';
import Organizers from '@/pages/Organizers';
import Account from '@/pages/Account';
import Admin from '@/pages/Admin';
import About from '@/pages/About';
import ContactUs from '@/pages/ContactUs';
import TipsCommunityMembers from '@/pages/TipsCommunityMembers';
import TipsOrganizers from '@/pages/TipsOrganizers';
import TipsSupporters from '@/pages/TipsSupporters';
import Supporters from '@/pages/Supporters';
import AdvertiserTerms from '@/pages/AdvertiserTerms';
import AdManager from '@/pages/AdManager';
import AdManagerPreview from '@/pages/AdManagerPreview';
import InviteOrganizerPage from '@/pages/InviteOrganizerPage';
import InviteCommunityMemberPage from '@/pages/InviteCommunityMemberPage';
import InviteSupporterPage from '@/pages/InviteSupporterPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-mint-100 border-t-mint-500 rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-heading">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* App routes inside layout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/post-event" element={<PostEvent />} />
        <Route path="/organizers" element={<Organizers />} />
        <Route path="/invite-organizer" element={<InviteOrganizerPage />} />
        <Route path="/invite-community-member" element={<InviteCommunityMemberPage />} />
        <Route path="/invite-supporter" element={<InviteSupporterPage />} />
        <Route path="/account" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/tips-community-members" element={<TipsCommunityMembers />} />
        <Route path="/tips-organizers" element={<TipsOrganizers />} />
        <Route path="/tips-supporters" element={<TipsSupporters />} />
        <Route path="/supporters" element={<Supporters />} />
        <Route path="/advertiser-terms" element={<AdvertiserTerms />} />
        <Route path="/ad-manager" element={<AdManager />} />
        <Route path="/ad-manager-preview" element={<AdManagerPreview />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <BetaStage1Gate>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </BetaStage1Gate>
  )
}

export default App
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/auth/SignUp";
import SignIn from "./pages/auth/SignIn";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Events from "./pages/Events";
import Communities from "./pages/Communities";
import CommunityDashboard from "./pages/CommunityDashboard";
import CommunityMemberView from "./pages/CommunityMemberView";
import CommunityPublicView from "./pages/CommunityPublicView";
import CreateEvent from "./pages/CreateEvent";
import EventDetails from "./pages/EventDetails";
import EditEvent from "./pages/EditEvent";
import EventDashboard from "./pages/EventDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/signup" element={<SignUp />} />
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:eventId" element={<EventDetails />} />
            <Route path="/events/:eventId/edit" element={<EditEvent />} />
            <Route path="/events/:eventId/dashboard" element={<EventDashboard />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/community/:communityId" element={<CommunityDashboard />} />
            <Route path="/community/:communityId/create-event" element={<CreateEvent />} />
            <Route path="/community/:communityId/member" element={<CommunityMemberView />} />
            <Route path="/community/:communityId/public" element={<CommunityPublicView />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { HashRouter as BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import PlaceDetail from "./pages/PlaceDetail";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Check if app is running inside an iframe
    const isInIframe = window.self !== window.top;
    
    // Check if user is admin (has auth token)
    const hasAuthToken = localStorage.getItem('sb-cgtlmnvwvhktopxavjan-auth-token');
    
    // If not in iframe and not admin, redirect to Blogger site
    if (!isInIframe && !hasAuthToken) {
      window.location.href = 'https://tr.tabirly.com/p/tabirly-perili-yerler-bilgi-bankas.html';
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/place/:id" element={<PlaceDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

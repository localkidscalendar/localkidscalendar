import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function Footer({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout(true);
  };

  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-0.5 mb-0 -mt-5">
              <div className="bg-white h-16 flex items-center">
                <img
                  src="https://media.base44.com/images/public/6a3b56ed3368aea2e0bb48dc/9943d8efa_Logo0.png"
                  alt="LocalKidsCalendar logo"
                  className="w-auto h-16 object-contain"
                />
              </div>
              <span className="font-heading font-bold text-foreground">LocalKids</span>
              <span className="font-heading font-bold text-mint-500">Calendar</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              LocalKidsCalendar.com is a community-powered hub for local kids activities, built by parents, for parents. We believe that every child deserves access to enriching local experiences and that finding those opportunities should be easy, fast, and free.{" "}
              <Link to="/about" className="text-mint-500 hover:underline">More ...</Link>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              (LocalKidsCalendar.com does not organize, administer, or endorse any listed activities. Content is contributed by the community.)
            </p>
          </div>
          <div>
            <h4 className="font-heading font-semibold text-sm mb-2">Explore</h4>
            <div className="flex flex-col gap-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Browse Activities</Link>
              <Link to="/post-event" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Post an Activity</Link>
              <Link to="/organizers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View Local Organizers</Link>
              <Link to="/supporters" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View Supporters</Link>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold text-sm mb-2">Grow</h4>
            <div className="flex flex-col gap-2">
              <Link to="/tips-community-members" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tips for Community Members</Link>
              <Link to="/tips-organizers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tips for Organizers</Link>
              <Link to="/tips-supporters" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tips for Supporters</Link>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold text-sm mb-2">Account</h4>
            <div className="flex flex-col gap-2">
              {!user && (
                <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Create Account</Link>
              )}
              {user ? (
                <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">Sign Out</button>
              ) : (
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
              )}
              {user && (
                <Link to="/account" className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Account</Link>
              )}
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact Us</Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} LocalKidsCalendar.com · United States</p>
            <Link to="/about#community-rules" className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
              Our Community Rules (Terms of Service and Privacy)
            </Link>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for local communities
          </p>
        </div>
      </div>
    </footer>
  );
}
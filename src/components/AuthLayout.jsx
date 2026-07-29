import React from "react";
import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex flex-col items-center gap-3 mb-4">
            <img
              src="/logo.png"
              alt="LocalKidsCalendar"
              className="h-20 w-20 object-contain border border-gray-300 rounded-xl bg-white"
            />
            <span className="font-heading font-bold text-xl leading-tight">
              <span className="text-foreground">LocalKids</span>
              <span className="text-mint-500">Calendar</span>
            </span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

export default function ZipRequiredModal({ onSubmit }) {
  const [zip, setZip] = useState("");
  const isValid = /^\d{5}$/.test(zip);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) onSubmit(zip);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg text-center">
        <div className="w-12 h-12 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-3">
          <MapPin className="w-6 h-6 text-mint-500" />
        </div>
        <h2 className="font-heading font-bold text-lg mb-1">Where are you located?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          We couldn't detect your location. Enter your zip code to see activities near you, or{" "}
          <Link to="/login" className="text-mint-600 underline hover:text-mint-700">Sign In</Link> if you have an account.
        </p>
        <Input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="e.g. 90210"
          maxLength={5}
          inputMode="numeric"
          autoFocus
          className="rounded-xl text-center text-lg mb-4"
        />
        <Button type="submit" disabled={!isValid} className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white">
          Show Activities
        </Button>
      </form>
    </div>
  );
}
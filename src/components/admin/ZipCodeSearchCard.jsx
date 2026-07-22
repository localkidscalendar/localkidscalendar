import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

// Generic "search by zip code" card. `rows` = [{ zip, ...counts }], `columns` = [{ key, label }]
export default function ZipCodeSearchCard({ title, rows, columns }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    const zip = query.trim();
    if (!zip) return;
    const match = rows.find((r) => r.zip === zip);
    setResult(match || { zip, ...Object.fromEntries(columns.map((c) => [c.key, 0])) });
    setSearched(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <h4 className="font-heading font-semibold text-sm mb-3">{title}</h4>
      <div className="flex gap-2">
        <Input
          placeholder="Enter zip code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="rounded-lg max-w-[200px]"
        />
        <Button size="sm" variant="outline" className="rounded-lg" onClick={handleSearch}>
          <Search className="w-3.5 h-3.5 mr-1.5" /> Search
        </Button>
      </div>
      {searched && result && (
        <div className="mt-3 flex items-center gap-4 text-sm bg-muted/40 rounded-lg px-3 py-2">
          <span className="font-medium">{result.zip}</span>
          {columns.map((c) => (
            <span key={c.key} className="text-muted-foreground">
              {c.label}: <span className="font-semibold text-foreground">{result[c.key] || 0}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
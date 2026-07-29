import React from "react";

// Generic top-10 zip code ranking card.
// `rows` = [{ zip, ...counts }], `columns` = [{ key, label }]
// Only zips with at least one non-zero count are shown, capped at 10 — avoids
// padding the list with a wall of zero-count zips during early rollout.
export default function ZipCodeRankingCard({ title, rows, columns }) {
  const ranked = rows
    .filter((r) => columns.some((c) => (r[c.key] || 0) > 0))
    .sort((a, b) => {
      // Rank by columns in order (primary, then tie-breakers)
      for (const c of columns) {
        const diff = (b[c.key] || 0) - (a[c.key] || 0);
        if (diff !== 0) return diff;
      }
      return String(a.zip).localeCompare(String(b.zip), undefined, { numeric: true });
    })
    .slice(0, 10);

  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <h4 className="font-heading font-semibold text-sm mb-3">{title}</h4>
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
      ) : (
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-24" />
            {columns.map((c) => (
              <col key={c.key} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th className="text-left py-1.5 font-medium">#</th>
              <th className="text-left py-1.5 font-medium">Zip Code</th>
              {columns.map((c) => (
                <th key={c.key} className="text-right py-1.5 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranked.map((r, idx) => (
              <tr key={r.zip}>
                <td className="py-1.5 text-muted-foreground">{idx + 1}</td>
                <td className="py-1.5 font-medium">{r.zip}</td>
                {columns.map((c) => (
                  <td key={c.key} className="py-1.5 text-right tabular-nums">{r[c.key] || 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function ImagePreviewModal({ imageUrl, onOpenChange }) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="sr-only">Ad Creative Preview</DialogTitle>
        {imageUrl && (
          <img src={imageUrl} alt="Ad creative preview" className="w-full rounded-lg border border-border" />
        )}
      </DialogContent>
    </Dialog>
  );
}
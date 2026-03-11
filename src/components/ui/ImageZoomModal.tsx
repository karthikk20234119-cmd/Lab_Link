import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImageZoomModalProps {
  imageUrl: string | null;
  altText: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageZoomModal({ imageUrl, altText, isOpen, onClose }: ImageZoomModalProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-none shadow-none"
        onInteractOutside={onClose}
      >
        <VisuallyHidden>
          <DialogTitle>Image Preview: {altText}</DialogTitle>
        </VisuallyHidden>
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full touch-target"
          aria-label="Close image preview"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Image container */}
        <div className="flex items-center justify-center w-full h-full">
          <img
            src={imageUrl}
            alt={altText}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

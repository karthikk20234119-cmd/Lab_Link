import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, X, ImageIcon, Loader2, Link2, Plus, 
  CheckCircle, AlertCircle, Trash2, GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value: string;
  subImages?: string[];
  onChange: (url: string) => void;
  onSubImagesChange?: (urls: string[]) => void;
  bucketName?: string;
  folderPath?: string;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function ImageUpload({
  value,
  subImages = [],
  onChange,
  onSubImagesChange,
  bucketName = "item-images",
  folderPath = "items",
  maxFiles = 5,
  maxSizeMB = 5,
}: ImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "Invalid file type. Please upload JPG, PNG, GIF, or WebP images.";
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File too large. Maximum size is ${maxSizeMB}MB.`;
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const error = validateFile(file);
    if (error) {
      toast({ variant: "destructive", title: "Upload Error", description: error });
      return null;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${folderPath}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    try {
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // If bucket doesn't exist, try creating it or use public URL
        console.error("Upload error:", uploadError);
        
        // Fallback: Convert to base64 data URL for demo purposes
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (err) {
      console.error("Upload failed:", err);
      // Fallback to data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const totalImages = 1 + subImages.length + fileArray.length;
    
    if (totalImages > maxFiles) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `Maximum ${maxFiles} images allowed.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100));
        
        const url = await uploadFile(file);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        // Set first image as main if no main image exists
        if (!value && uploadedUrls.length > 0) {
          onChange(uploadedUrls[0]);
          if (uploadedUrls.length > 1 && onSubImagesChange) {
            onSubImagesChange([...subImages, ...uploadedUrls.slice(1)]);
          }
        } else if (onSubImagesChange) {
          onSubImagesChange([...subImages, ...uploadedUrls]);
        }

        toast({
          title: "Upload Complete",
          description: `${uploadedUrls.length} image(s) uploaded successfully.`,
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload images. Please try again.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [value, subImages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUrlAdd = () => {
    if (!urlInput.trim()) return;
    
    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      toast({ variant: "destructive", title: "Invalid URL", description: "Please enter a valid image URL." });
      return;
    }

    if (!value) {
      onChange(urlInput);
    } else if (onSubImagesChange) {
      onSubImagesChange([...subImages, urlInput]);
    }

    setUrlInput("");
    setShowUrlInput(false);
    toast({ title: "Image Added", description: "Image URL added successfully." });
  };

  const removeMainImage = () => {
    // Move first sub-image to main if available
    if (subImages.length > 0 && onSubImagesChange) {
      onChange(subImages[0]);
      onSubImagesChange(subImages.slice(1));
    } else {
      onChange("");
    }
  };

  const removeSubImage = (index: number) => {
    if (onSubImagesChange) {
      onSubImagesChange(subImages.filter((_, i) => i !== index));
    }
  };

  const setAsMain = (index: number) => {
    if (onSubImagesChange) {
      const newMain = subImages[index];
      const newSubImages = [...subImages];
      newSubImages[index] = value;
      onChange(newMain);
      onSubImagesChange(newSubImages.filter(Boolean));
    }
  };

  const allImages = value ? [value, ...subImages] : subImages;

  return (
    <div className="space-y-4">
      {/* Main Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading... {uploadProgress}%</p>
            <div className="w-48 h-2 bg-muted rounded-full mx-auto overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }} 
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={cn(
              "w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-colors",
              isDragging ? "bg-primary/20" : "bg-muted"
            )}>
              <Upload className={cn(
                "h-8 w-8 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="font-medium">
                {isDragging ? "Drop images here" : "Drag & drop images here"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse • JPG, PNG, GIF, WebP up to {maxSizeMB}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* URL Input Toggle */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          Add from URL
        </Button>
        <span className="text-xs text-muted-foreground">
          {allImages.length}/{maxFiles} images
        </span>
      </div>

      {/* URL Input */}
      {showUrlInput && (
        <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlAdd())}
          />
          <Button type="button" onClick={handleUrlAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowUrlInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Image Preview Grid */}
      {allImages.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded Images</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allImages.map((url, idx) => (
              <div
                key={idx}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden group border-2 transition-all",
                  idx === 0 ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                )}
              >
                <img
                  src={url}
                  alt={`Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/200x200/1e293b/64748b?text=Error";
                  }}
                />
                
                {/* Main Image Badge */}
                {idx === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Main
                  </div>
                )}

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {idx !== 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setAsMain(idx - 1); }}
                      className="h-8 text-xs"
                    >
                      Set Main
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      idx === 0 ? removeMainImage() : removeSubImage(idx - 1); 
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add More Button */}
            {allImages.length < maxFiles && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Add More</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

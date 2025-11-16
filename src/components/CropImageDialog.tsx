import { useState, useRef, useEffect } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

interface CropImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
}

export function CropImageDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 16 / 9,
}: CropImageDialogProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [processing, setProcessing] = useState(false);

  // Fixed quality and size settings
  const quality = 85;
  const maxWidth = 1920;

  useEffect(() => {
    if (open) {
      // Reset crop when dialog opens
      setCrop({
        unit: "%",
        width: 90,
        height: 90,
        x: 5,
        y: 5,
      });
    }
  }, [open]);

  const getCroppedImg = async (): Promise<Blob> => {
    const image = imgRef.current;
    const crop = completedCrop;

    if (!image || !crop) {
      throw new Error("No image or crop defined");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate output dimensions
    let outputWidth = crop.width * scaleX;
    let outputHeight = crop.height * scaleY;

    // Resize if larger than maxWidth
    if (outputWidth > maxWidth) {
      outputHeight = (outputHeight * maxWidth) / outputWidth;
      outputWidth = maxWidth;
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality / 100
      );
    });
  };

  const handleCropComplete = async () => {
    if (!completedCrop) {
      toast.error("Please select an area to crop");
      return;
    }

    try {
      setProcessing(true);
      const croppedBlob = await getCroppedImg();

      // Compress the image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: maxWidth,
        useWebWorker: true,
        initialQuality: quality / 100,
      };

      const compressedFile = await imageCompression(
        new File([croppedBlob], "cropped.jpg", { type: "image/jpeg" }),
        options
      );

      const finalSize = (compressedFile.size / 1024).toFixed(2);
      toast.success(`Image optimized to ${finalSize} KB`);

      onCropComplete(compressedFile);
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crop Poster</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div className="flex justify-center bg-muted rounded-lg p-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              className="max-h-[60vh]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                className="max-w-full"
                style={{ maxHeight: "60vh" }}
              />
            </ReactCrop>
          </div>

          {/* Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
            <p>
              💡 Drag the corners to adjust the crop area
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button onClick={handleCropComplete} disabled={processing}>
            {processing ? "Processing..." : "Apply & Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

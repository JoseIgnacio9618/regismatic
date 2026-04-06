import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import { RequestLoadingService } from "src/app/core/services/request-loading.service";

type CropResult = {
  file: File;
  previewUrl: string;
};

@Component({
  selector: "app-photo-cropper",
  templateUrl: "./photo-cropper.component.html",
  styleUrls: ["./photo-cropper.component.scss"],
  standalone: false
})
export class PhotoCropperComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() sourceUrl: string | null = null;
  @Input() fullName = "";

  @Output() cancel = new EventEmitter<void>();
  @Output() confirmCrop = new EventEmitter<CropResult>();

  @ViewChild("stage") stageRef?: ElementRef<HTMLDivElement>;
  @ViewChild("image") imageRef?: ElementRef<HTMLImageElement>;
  @ViewChild("previewCanvas") previewCanvasRef?: ElementRef<HTMLCanvasElement>;

  readonly outputWidth = 240;
  readonly outputHeight = 320;

  imageLoaded = false;
  zoom = 1;
  offsetX = 0;
  offsetY = 0;

  private naturalWidth = 0;
  private naturalHeight = 0;
  private stageWidth = 0;
  private stageHeight = 0;
  private baseScale = 1;
  private pointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private stageResizeObserver?: ResizeObserver;
  private resizeHandler = () => this.syncStageAndPreview();
  private previewFrame: number | null = null;
  private syncRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private cropperLoadingRequestId: number | null = null;

  constructor(private readonly requestLoadingService: RequestLoadingService) {}

  ngAfterViewInit(): void {
    window.addEventListener("resize", this.resizeHandler);
    this.attachStageObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue) {
      this.resetState();
      this.beginCropperLoading();
      queueMicrotask(() => this.scheduleInitialSync());
      return;
    }

    if (changes["isOpen"] && !changes["isOpen"].currentValue) {
      this.finishCropperLoading();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener("resize", this.resizeHandler);
    this.stageResizeObserver?.disconnect();
    if (this.previewFrame !== null) {
      cancelAnimationFrame(this.previewFrame);
    }
    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
    }
    this.finishCropperLoading();
  }

  get imageTransform(): string {
    return "none";
  }

  get displayedImageWidth(): number {
    return this.naturalWidth * this.baseScale * this.zoom;
  }

  get displayedImageHeight(): number {
    return this.naturalHeight * this.baseScale * this.zoom;
  }

  get imageLeft(): number {
    return (this.stageWidth - this.displayedImageWidth) / 2 + this.offsetX;
  }

  get imageTop(): number {
    return (this.stageHeight - this.displayedImageHeight) / 2 + this.offsetY;
  }

  onImageLoad(): void {
    const image = this.imageRef?.nativeElement;
    if (!image) {
      return;
    }

    this.naturalWidth = image.naturalWidth;
    this.naturalHeight = image.naturalHeight;
    this.imageLoaded = true;
    this.finishCropperLoading();
    this.scheduleInitialSync(true);
  }

  onImageError(): void {
    this.finishCropperLoading();
  }

  onZoomChange(): void {
    this.constrainOffsets();
    this.schedulePreviewRender();
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.imageLoaded || (event.button !== 0 && event.button !== 2)) {
      return;
    }

    event.preventDefault();
    this.pointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginX = this.offsetX;
    this.dragOriginY = this.offsetY;
    this.stageRef?.nativeElement.setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    this.offsetX = this.dragOriginX + (event.clientX - this.dragStartX);
    this.offsetY = this.dragOriginY + (event.clientY - this.dragStartY);
    this.constrainOffsets();
    this.schedulePreviewRender();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerId === event.pointerId) {
      this.stageRef?.nativeElement.releasePointerCapture(event.pointerId);
      this.pointerId = null;
    }
  }

  close(): void {
    this.finishCropperLoading();
    this.cancel.emit();
  }

  async apply(): Promise<void> {
    const canvas = document.createElement("canvas");
    canvas.width = this.outputWidth;
    canvas.height = this.outputHeight;

    const context = canvas.getContext("2d");
    const image = this.imageRef?.nativeElement;

    if (!context || !image || !this.imageLoaded) {
      return;
    }

    const crop = this.buildCropRect();

    context.drawImage(
      image,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      0,
      0,
      this.outputWidth,
      this.outputHeight
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
    if (!blob) {
      return;
    }

    const file = new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(blob);
    this.confirmCrop.emit({ file, previewUrl });
  }

  private syncStageAndPreview(reset = false): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    this.stageWidth = rect.width;
    this.stageHeight = rect.height;

    if (!this.stageWidth || !this.stageHeight || !this.naturalWidth || !this.naturalHeight) {
      return;
    }

    this.baseScale = Math.max(this.stageWidth / this.naturalWidth, this.stageHeight / this.naturalHeight);

    if (reset) {
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
    }

    this.constrainOffsets();
    this.schedulePreviewRender();
  }

  private attachStageObserver(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage || typeof ResizeObserver === "undefined") {
      return;
    }

    this.stageResizeObserver?.disconnect();
    this.stageResizeObserver = new ResizeObserver(() => this.syncStageAndPreview());
    this.stageResizeObserver.observe(stage);
  }

  private scheduleInitialSync(reset = false): void {
    this.attachStageObserver();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.syncStageAndPreview(reset);
      });
    });

    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
    }

    this.syncRetryTimer = setTimeout(() => {
      this.syncStageAndPreview(reset);
      this.syncRetryTimer = null;
    }, 180);
  }

  private buildCropRect(): { sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number } {
    const currentScale = this.baseScale * this.zoom;

    return {
      sourceX: Math.max(0, (0 - this.imageLeft) / currentScale),
      sourceY: Math.max(0, (0 - this.imageTop) / currentScale),
      sourceWidth: Math.min(this.naturalWidth, this.stageWidth / currentScale),
      sourceHeight: Math.min(this.naturalHeight, this.stageHeight / currentScale)
    };
  }

  private constrainOffsets(): void {
    const currentScale = this.baseScale * this.zoom;
    const displayedWidth = this.naturalWidth * currentScale;
    const displayedHeight = this.naturalHeight * currentScale;

    const maxOffsetX = Math.max(0, (displayedWidth - this.stageWidth) / 2);
    const maxOffsetY = Math.max(0, (displayedHeight - this.stageHeight) / 2);

    this.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, this.offsetX));
    this.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, this.offsetY));
  }

  private schedulePreviewRender(): void {
    if (this.previewFrame !== null) {
      cancelAnimationFrame(this.previewFrame);
    }

    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = null;
      this.renderPreview();
    });
  }

  private renderPreview(): void {
    const canvas = this.previewCanvasRef?.nativeElement;
    const image = this.imageRef?.nativeElement;

    if (!canvas || !image || !this.imageLoaded) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const crop = this.buildCropRect();
    canvas.width = 150;
    canvas.height = 200;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, canvas.width, canvas.height);
  }

  private resetState(): void {
    this.finishCropperLoading();

    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }

    this.imageLoaded = false;
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }

  private beginCropperLoading(): void {
    this.finishCropperLoading();
    this.cropperLoadingRequestId = this.requestLoadingService.beginRequest();
  }

  private finishCropperLoading(): void {
    if (this.cropperLoadingRequestId === null) {
      return;
    }

    this.requestLoadingService.endRequest(this.cropperLoadingRequestId);
    this.cropperLoadingRequestId = null;
  }
}

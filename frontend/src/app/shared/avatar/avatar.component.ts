import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { ApiService } from "src/app/core/services/api.service";

@Component({
  selector: "app-avatar",
  templateUrl: "./avatar.component.html",
  styleUrls: ["./avatar.component.scss"],
  standalone: false
})
export class AvatarComponent implements OnChanges, OnDestroy {
  @Input() fullName = "";
  @Input() photoUrl: string | null | undefined = null;
  @Input() size: "sm" | "md" | "lg" = "md";

  hasImageError = false;
  resolvedPhotoUrl: string | null = null;
  private ownedObjectUrl: string | null = null;
  private loadSequence = 0;

  constructor(private readonly apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["photoUrl"]) {
      this.hasImageError = false;
      void this.loadPhotoUrl();
    }
  }

  ngOnDestroy(): void {
    this.clearOwnedObjectUrl();
  }

  get initials(): string {
    const parts = this.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return "?";
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  onImageError(): void {
    this.hasImageError = true;
    this.resolvedPhotoUrl = null;
    this.clearOwnedObjectUrl();
  }

  private async loadPhotoUrl(): Promise<void> {
    const sequence = ++this.loadSequence;
    this.clearOwnedObjectUrl();
    this.resolvedPhotoUrl = null;

    if (!this.photoUrl) {
      return;
    }

    if (/^(blob:|data:)/i.test(this.photoUrl)) {
      this.resolvedPhotoUrl = this.photoUrl;
      return;
    }

    try {
      const objectUrl = await this.apiService.getProtectedAssetObjectUrl(this.photoUrl);
      if (sequence !== this.loadSequence) {
        if (objectUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(objectUrl);
        }
        return;
      }

      this.ownedObjectUrl = objectUrl?.startsWith("blob:") ? objectUrl : null;
      this.resolvedPhotoUrl = objectUrl;
    } catch {
      if (sequence === this.loadSequence) {
        this.hasImageError = true;
        this.resolvedPhotoUrl = null;
      }
    }
  }

  private clearOwnedObjectUrl(): void {
    if (this.ownedObjectUrl) {
      URL.revokeObjectURL(this.ownedObjectUrl);
      this.ownedObjectUrl = null;
    }
  }
}

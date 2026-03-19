import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { ApiService } from "src/app/core/services/api.service";

@Component({
  selector: "app-avatar",
  templateUrl: "./avatar.component.html",
  styleUrls: ["./avatar.component.scss"],
  standalone: false
})
export class AvatarComponent implements OnChanges {
  @Input() fullName = "";
  @Input() photoUrl: string | null | undefined = null;
  @Input() size: "sm" | "md" | "lg" = "md";

  hasImageError = false;

  constructor(private readonly apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["photoUrl"]) {
      this.hasImageError = false;
    }
  }

  get resolvedPhotoUrl(): string | null {
    if (this.hasImageError) {
      return null;
    }

    return this.apiService.buildAssetUrl(this.photoUrl);
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
  }
}

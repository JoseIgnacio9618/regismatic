import { Injectable, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { ToastController } from "@ionic/angular";
import { BehaviorSubject, Subscription } from "rxjs";
import { PushPlatform, UserNotification } from "../models/types";
import { ApiService } from "./api.service";
import { AuthService } from "./auth.service";
import { I18nService } from "./i18n.service";

@Injectable({ providedIn: "root" })
export class NotificationService implements OnDestroy {
  private readonly notificationsState = new BehaviorSubject<UserNotification[]>([]);
  private readonly unreadCountState = new BehaviorSubject<number>(0);
  private readonly seenIds = new Set<string>();
  private authSubscription: Subscription;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private activeUserId: string | null = null;
  private pushReady = false;
  private pushListenersRegistered = false;

  readonly notifications$ = this.notificationsState.asObservable();
  readonly unreadCount$ = this.unreadCountState.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly i18nService: I18nService,
    private readonly toastController: ToastController,
    private readonly router: Router
  ) {
    this.authSubscription = this.authService.user$.subscribe((user) => {
      void this.onAuthStateChange(user?.id ?? null);
    });
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.stopPolling();
  }

  get unreadCount(): number {
    return this.unreadCountState.value;
  }

  async refresh(initial = false): Promise<void> {
    if (!this.activeUserId) {
      return;
    }

    const response = await this.apiService.get<{ notifications: UserNotification[]; unreadCount: number }>(
      "/notifications?limit=12",
      true
    );

    const previousSeen = new Set(this.seenIds);
    this.notificationsState.next(response.notifications);
    this.unreadCountState.next(response.unreadCount);

    for (const notification of response.notifications) {
      this.seenIds.add(notification.id);
    }

    if (!initial) {
      const freshNotifications = response.notifications
        .filter((notification) => !previousSeen.has(notification.id))
        .reverse()
        .slice(-3);

      for (const notification of freshNotifications) {
        await this.presentToast(notification);
      }
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.apiService.patch(`/notifications/${notificationId}/read`, {}, true);
    await this.refresh(true);
  }

  async markAllAsRead(): Promise<void> {
    await this.apiService.patch("/notifications/read-all", {}, true);
    await this.refresh(true);
  }

  async goToNotification(notification: UserNotification): Promise<void> {
    const route = typeof notification.metadata?.["route"] === "string" ? notification.metadata["route"] : null;
    if (route) {
      await this.router.navigateByUrl(route);
    } else {
      await this.router.navigateByUrl("/reports");
    }
    await this.markAsRead(notification.id);
  }

  private async onAuthStateChange(userId: string | null): Promise<void> {
    if (!userId) {
      this.activeUserId = null;
      this.notificationsState.next([]);
      this.unreadCountState.next(0);
      this.seenIds.clear();
      this.stopPolling();
      return;
    }

    if (this.activeUserId === userId) {
      return;
    }

    this.activeUserId = userId;
    this.seenIds.clear();
    await this.refresh(true);
    this.startPolling();
    await this.initPushIfNeeded();
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      void this.refresh(false);
    }, 30_000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async initPushIfNeeded(): Promise<void> {
    if (this.pushReady) {
      return;
    }

    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (!this.pushListenersRegistered) {
      await PushNotifications.addListener("registration", (token) => {
        void this.registerPushToken(token.value, this.getPushPlatform(Capacitor.getPlatform()));
      });

      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        void this.presentToast({
          title: notification.title ?? this.i18nService.t("notifications.new_title"),
          body: notification.body ?? this.i18nService.t("notifications.new_body")
        });
        void this.refresh(false);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const route = typeof notification.data?.["route"] === "string" ? notification.data["route"] : null;
        if (route) {
          void this.router.navigateByUrl(route);
        }
        void this.refresh(false);
      });

      this.pushListenersRegistered = true;
    }

    const permissionResult = await PushNotifications.requestPermissions();
    if (permissionResult.receive !== "granted") {
      return;
    }

    await PushNotifications.register();
    this.pushReady = true;
  }

  private async registerPushToken(token: string, platform: PushPlatform): Promise<void> {
    await this.apiService.post(
      "/notifications/push-token",
      {
        token,
        platform
      },
      true
    );
  }

  private getPushPlatform(platform: string): PushPlatform {
    if (platform === "ios") {
      return "IOS";
    }
    if (platform === "android") {
      return "ANDROID";
    }
    return "WEB";
  }

  private async presentToast(notification: Pick<UserNotification, "title" | "body">): Promise<void> {
    const toast = await this.toastController.create({
      header: notification.title,
      message: notification.body,
      duration: 3200,
      color: "primary",
      position: "top"
    });
    await toast.present();
  }
}

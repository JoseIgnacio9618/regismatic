import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: "root" })
export class RequestLoadingService {
  private readonly loadingState = new BehaviorSubject(false);
  readonly loading$ = this.loadingState.asObservable();

  private nextRequestId = 0;
  private pendingSlowRequests = 0;
  private readonly requestDelayTimers = new Map<number, ReturnType<typeof setTimeout>>();

  beginRequest(): number {
    const requestId = ++this.nextRequestId;
    const timer = setTimeout(() => {
      this.requestDelayTimers.delete(requestId);
      this.pendingSlowRequests += 1;
      if (!this.loadingState.value) {
        this.loadingState.next(true);
      }
    }, 1000);

    this.requestDelayTimers.set(requestId, timer);
    return requestId;
  }

  endRequest(requestId: number): void {
    const timer = this.requestDelayTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.requestDelayTimers.delete(requestId);
      return;
    }

    if (this.pendingSlowRequests > 0) {
      this.pendingSlowRequests -= 1;
      if (this.pendingSlowRequests === 0 && this.loadingState.value) {
        this.loadingState.next(false);
      }
    }
  }
}

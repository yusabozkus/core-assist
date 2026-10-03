import { Injectable } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';

@Injectable()
export class RuntimeState {
  ready = false;
  draining = false;
  readonly stopped = new ReplaySubject<void>(1);

  beginShutdown() {
    if (this.draining) return;
    this.draining = true;
    this.ready = false;
    this.stopped.next();
    this.stopped.complete();
  }
}

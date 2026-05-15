import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

function showBootstrapFailure(err: unknown): void {
  console.error(err);
  const text = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  const pre = document.createElement('pre');
  pre.setAttribute('data-transitrack', 'bootstrap-error');
  pre.style.cssText =
    'box-sizing:border-box;margin:0;padding:12px;width:100%;min-height:100vh;' +
    'white-space:pre-wrap;word-break:break-word;font:12px/1.4 system-ui,monospace;' +
    'color:#fff;background:#7f1d1d;';
  pre.textContent = `TransiTrack failed to start (Angular bootstrap).\n\n${text}`;
  document.body.appendChild(pre);
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err: unknown) => showBootstrapFailure(err));

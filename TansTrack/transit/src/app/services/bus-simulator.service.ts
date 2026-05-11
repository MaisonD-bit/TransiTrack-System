import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BusSimulatorService {
  /**
   * Simulate movement along a LineString coordinates array.
   * @param coords Array of [lng, lat]
   * @param intervalMs milliseconds between emitted positions
   */
  simulateAlongLine(
    coords: number[][],
    intervalMs: number = 55000,
    startIndex: number = 0
  ): Observable<{ lng: number; lat: number; index: number }> {
    const out$ = new Subject<{ lng: number; lat: number; index: number }>();

    if (!coords || coords.length === 0) {
      setTimeout(() => out$.complete(), 0);
      return out$.asObservable();
    }

    const steps: { lng: number; lat: number }[] = [];

    const points = coords
      .filter((c) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
      .map((c) => ({ lng: Number(c[0]), lat: Number(c[1]) }));

    if (points.length < 2) {
      setTimeout(() => out$.complete(), 0);
      return out$.asObservable();
    }

    const interpolateSegment = (a: { lng: number; lat: number }, b: { lng: number; lat: number }, n: number) => {
      const res: { lng: number; lat: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = n === 0 ? 0 : i / n;
        res.push({
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        });
      }
      return res;
    };

    // Mapbox routes often have hundreds of vertices — skip extra interpolation for dense routes
    // to avoid exploding step count and constant re-animation on each drawRoute call.
    const denseRoute = points.length > 100;
    const stepsBetweenVertices = denseRoute ? 0 : 5;

    if (denseRoute) {
      for (const p of points) {
        steps.push({ lng: p.lng, lat: p.lat });
      }
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        const seg = interpolateSegment(points[i], points[i + 1], stepsBetweenVertices);
        seg.pop();
        steps.push(...seg);
      }
      steps.push(points[points.length - 1]);
    }

    let idx = Math.max(0, Math.min(startIndex, steps.length - 1));
    const t = timer(0, intervalMs).subscribe(() => {
      if (idx >= steps.length) {
        t.unsubscribe();
        out$.complete();
        return;
      }
      out$.next({ lng: steps[idx].lng, lat: steps[idx].lat, index: idx });
      idx++;
    });

    return new Observable((sub) => {
      const subInner = out$.subscribe(
        (v) => sub.next(v),
        (e) => sub.error(e),
        () => sub.complete()
      );
      return () => {
        subInner.unsubscribe();
        t.unsubscribe();
      };
    });
  }
}

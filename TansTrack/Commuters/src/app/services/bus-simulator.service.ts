import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BusSimulatorService {
  /**
   * Simulate movement along a LineString coordinates array.
   * @param coords Array of [lng, lat]
   * @param intervalMs milliseconds between emitted positions
   */
  simulateAlongLine(coords: number[][], intervalMs: number = 5000): Observable<{ lng: number; lat: number; index: number; }> {
    const out$ = new Subject<{ lng: number; lat: number; index: number; }>();

    if (!coords || coords.length === 0) {
      setTimeout(() => out$.complete(), 0);
      return out$.asObservable();
    }

    // Flatten the coordinates into a sequence of steps using linear interpolation between points
    const steps: { lng: number; lat: number }[] = [];
    
    // Validate and convert coordinates
    const points = coords
      .filter(c => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
      .map(c => ({ lng: Number(c[0]), lat: Number(c[1]) }));
    
    if (points.length < 2) {
      console.error('Not enough valid coordinates for simulation');
      setTimeout(() => out$.complete(), 0);
      return out$.asObservable();
    }
    
    console.log('BusSimulator: Processing', points.length, 'valid points');

    // Choose number of interpolation steps between points based on distance (simple heuristic)
    const interpolate = (a: any, b: any, n: number) => {
      const res: { lng: number; lat: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        res.push({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t });
      }
      return res;
    };

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      
      // Simple interpolation: use fixed number of steps between points
      // This creates smooth animation without complex distance calculations
      // Mapbox geometry already provides well-distributed waypoints along actual roads
      const n = 5; // Fixed 5 interpolation steps between each waypoint
      
      console.log(`Segment ${i}: Adding ${n} interpolation steps`);
      
      const seg = interpolate(a, b, n);
      // drop last to avoid duplicates between segments
      seg.pop();
      steps.push(...seg);
    }
    // push last point
    steps.push(points[points.length - 1]);
    
    console.log(`Total interpolated steps: ${steps.length}`);

    let idx = 0;
    const t = timer(0, intervalMs).subscribe(() => {
      if (idx >= steps.length) {
        idx = 0; // loop
      }
      out$.next({ lng: steps[idx].lng, lat: steps[idx].lat, index: idx });
      idx++;
    });

    // When consumer unsubscribes, stop the timer
    return new Observable(sub => {
      const subInner = out$.subscribe(v => sub.next(v), e => sub.error(e), () => sub.complete());
      return () => {
        subInner.unsubscribe();
        t.unsubscribe();
      };
    });
  }
}

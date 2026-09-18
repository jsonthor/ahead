"use client";

import { downsampleStream } from "@/lib/fit/stream";
import { useEffect, useMemo, useRef } from "react";

type GpsPoint = { lat: number; lng: number };

function leafletApi(mod: typeof import("leaflet") & { default?: typeof import("leaflet") }) {
  const candidate = mod.default ?? mod;
  if (typeof candidate.map === "function") {
    return candidate;
  }
  return mod;
}

export function ActivityMap({ points }: { points: GpsPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const track = useMemo(() => downsampleStream(points, 800), [points]);
  const pathKey = useMemo(() => {
    const first = track[0];
    const last = track[track.length - 1];
    if (!first || !last) {
      return "";
    }
    return `${track.length}:${first.lat},${first.lng}:${last.lat},${last.lng}`;
  }, [track]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || track.length < 2) {
      return;
    }

    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let observer: ResizeObserver | null = null;
    const timers: number[] = [];

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) {
        return;
      }
      const L = leafletApi(mod);
      const host = containerRef.current;
      if ("_leaflet_id" in host) {
        delete (host as { _leaflet_id?: number })._leaflet_id;
      }
      const latlngs = track.map((point) => [point.lat, point.lng] as [number, number]);
      const color =
        getComputedStyle(host).getPropertyValue("--forest").trim() || "#00e05a";
      const ember =
        getComputedStyle(host).getPropertyValue("--ember").trim() || "#d4a574";

      map = L.map(host, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri",
          maxZoom: 16,
        },
      ).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 16,
        },
      ).addTo(map);

      const line = L.polyline(latlngs, {
        color,
        weight: 4,
        opacity: 0.95,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      const start = latlngs[0];
      const end = latlngs[latlngs.length - 1];
      if (start) {
        L.circleMarker(start, {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 1,
          weight: 0,
        }).addTo(map);
      }
      if (end) {
        L.circleMarker(end, {
          radius: 6,
          color: ember,
          fillColor: ember,
          fillOpacity: 1,
          weight: 0,
        }).addTo(map);
      }

      const bounds = line.getBounds();
      const layout = () => {
        if (!map) {
          return;
        }
        map.invalidateSize();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
        }
      };
      layout();
      timers.push(window.setTimeout(layout, 50));
      timers.push(window.setTimeout(layout, 250));
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(host);
    });

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      observer?.disconnect();
      map?.remove();
      map = null;
    };
  }, [pathKey, track]);

  if (track.length < 2) {
    return null;
  }

  return (
    <figure className="activity-map isolate h-72 overflow-hidden border border-line bg-paper-sunken sm:h-80">
      <figcaption className="sr-only">GPS route on map</figcaption>
      <div ref={containerRef} className="h-full w-full" role="img" aria-label="Route map" />
    </figure>
  );
}

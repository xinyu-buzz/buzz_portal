import { useMemo } from "react";
import { projectToSvg, getColorForCount } from "./geoUtils";
import type { GeoJson, TooltipData } from "./types";
import { DRILLDOWN_COUNTRIES } from "./types";

type Props = {
  geoJson: GeoJson | null;
  counts: Map<string, number>;
  maxCount: number;
  onCountryClick: (iso: string) => void;
  onHover: (data: TooltipData | null) => void;
};

export const WorldMapSvg = ({
  geoJson,
  counts,
  maxCount,
  onCountryClick,
  onHover,
}: Props) => {
  const paths = useMemo(() => {
    if (!geoJson) return [];
    return geoJson.features.map((feature) => {
      const iso = feature.properties.ISO_A3 ?? "";
      return {
        iso,
        name: feature.properties.NAME,
        d: projectToSvg(feature.geometry),
        count: counts.get(iso) || 0,
        drillable: iso in DRILLDOWN_COUNTRIES,
      };
    });
  }, [geoJson, counts]);

  if (!geoJson) {
    return <p style={{ color: "var(--muted)" }}>Loading map...</p>;
  }

  return (
    <svg
      viewBox="-180 -90 360 180"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", maxHeight: 400 }}
    >
      {paths.map((p) => (
        <path
          key={p.iso + p.d.slice(0, 20)}
          d={p.d}
          fill={getColorForCount(p.count, maxCount)}
          stroke="#444a58"
          strokeWidth={0.3}
          style={{
            cursor: p.drillable ? "pointer" : "default",
            transition: "fill 200ms",
          }}
          onClick={() => {
            if (p.drillable) onCountryClick(p.iso);
          }}
          onMouseMove={(e) => {
            const svg = (e.target as SVGElement).closest("svg");
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            onHover({
              name: p.name,
              count: p.count,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseLeave={() => onHover(null)}
        />
      ))}
    </svg>
  );
};

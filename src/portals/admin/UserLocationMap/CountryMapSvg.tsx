import { useMemo } from "react";
import { projectToSvg, getColorForCount, getBoundingBox } from "./geoUtils";
import type { GeoJson, TooltipData } from "./types";

type Props = {
  geoJson: GeoJson | null;
  counts: Map<string, number>;
  maxCount: number;
  onHover: (data: TooltipData | null) => void;
};

export const CountryMapSvg = ({
  geoJson,
  counts,
  maxCount,
  onHover,
}: Props) => {
  const { paths, viewBox } = useMemo(() => {
    if (!geoJson || geoJson.features.length === 0) {
      return { paths: [], viewBox: "-180 -90 360 180" };
    }

    const box = getBoundingBox(geoJson.features);
    const vb = `${box[0]} ${box[1]} ${box[2]} ${box[3]}`;

    const items = geoJson.features.map((feature) => {
      const name = feature.properties.NAME_1 || feature.properties.NAME;
      return {
        key: feature.properties.ISO_3166_2 || name,
        name,
        d: projectToSvg(feature.geometry),
        count: counts.get(name) || 0,
      };
    });

    return { paths: items, viewBox: vb };
  }, [geoJson, counts]);

  if (!geoJson) {
    return <p style={{ color: "var(--muted)" }}>Loading region data...</p>;
  }

  if (paths.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No region data available.</p>;
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", maxHeight: 400 }}
    >
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill={getColorForCount(p.count, maxCount)}
          stroke="#444a58"
          strokeWidth={0.15}
          style={{ transition: "fill 200ms" }}
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

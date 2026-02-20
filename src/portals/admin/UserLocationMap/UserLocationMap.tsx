import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../../utility";
import { WorldMapSvg } from "./WorldMapSvg";
import { CountryMapSvg } from "./CountryMapSvg";
import { findFeature } from "./geoUtils";
import type {
  LocationProfile,
  GeoJson,
  DrillDownCountry,
  TooltipData,
} from "./types";
import { DRILLDOWN_COUNTRIES, DRILLDOWN_FILES } from "./types";

const BAR_COLORS = [
  "#6b8cae",
  "#8eaac9",
  "#ffa500",
  "#7ecb7e",
  "#c97ec9",
  "#e8746a",
];

export const UserLocationMap = () => {
  const [profiles, setProfiles] = useState<LocationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] =
    useState<DrillDownCountry | null>(null);
  const [worldGeo, setWorldGeo] = useState<GeoJson | null>(null);
  const [countryGeo, setCountryGeo] = useState<GeoJson | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  /* ── Fetch profiles with location ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabaseClient
        .from("profiles")
        .select(
          "id, last_location_lat, last_location_lng, last_location_update, selected_region",
        )
        .not("last_location_lat", "is", null)
        .not("last_location_lng", "is", null);

      if (fetchError) {
        setError("Failed to load user location data.");
        console.error(fetchError);
      } else {
        setProfiles((data as LocationProfile[]) || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  /* ── Lazy-load world GeoJSON ── */
  useEffect(() => {
    fetch("/geo/world-110m.json")
      .then((r) => r.json())
      .then((d: GeoJson) => setWorldGeo(d))
      .catch(() => setError("Failed to load world map data."));
  }, []);

  /* ── Lazy-load country GeoJSON on drill-down ── */
  useEffect(() => {
    if (!selectedCountry) {
      setCountryGeo(null);
      return;
    }
    fetch(DRILLDOWN_FILES[selectedCountry])
      .then((r) => r.json())
      .then((d: GeoJson) => setCountryGeo(d))
      .catch(() => setError("Failed to load region data."));
  }, [selectedCountry]);

  /* ── Aggregate by country ── */
  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!worldGeo) return map;
    for (const p of profiles) {
      const feature = findFeature(
        p.last_location_lng,
        p.last_location_lat,
        worldGeo.features,
      );
      if (feature && feature.properties.ISO_A3) {
        const iso = feature.properties.ISO_A3;
        map.set(iso, (map.get(iso) || 0) + 1);
      }
    }
    return map;
  }, [profiles, worldGeo]);

  /* ── Aggregate by state/province for drill-down ── */
  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!countryGeo || !selectedCountry) return map;
    for (const p of profiles) {
      const feature = findFeature(
        p.last_location_lng,
        p.last_location_lat,
        countryGeo.features,
      );
      if (feature) {
        const name = feature.properties.NAME_1 || feature.properties.NAME;
        map.set(name, (map.get(name) || 0) + 1);
      }
    }
    return map;
  }, [profiles, countryGeo, selectedCountry]);

  /* ── Derived stats ── */
  const totalLocated = profiles.length;
  const countriesRepresented = countryCounts.size;

  const maxCountryCount = useMemo(() => {
    let max = 0;
    for (const c of countryCounts.values()) {
      if (c > max) max = c;
    }
    return max || 1;
  }, [countryCounts]);

  const maxStateCount = useMemo(() => {
    let max = 0;
    for (const c of stateCounts.values()) {
      if (c > max) max = c;
    }
    return max || 1;
  }, [stateCounts]);

  const topEntries = useMemo(() => {
    const source = selectedCountry ? stateCounts : countryCounts;
    return Array.from(source.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [countryCounts, stateCounts, selectedCountry]);

  /* ── Country name lookup from GeoJSON ── */
  const countryNames = useMemo(() => {
    const map = new Map<string, string>();
    if (!worldGeo) return map;
    for (const f of worldGeo.features) {
      if (f.properties.ISO_A3) {
        map.set(f.properties.ISO_A3, f.properties.NAME);
      }
    }
    return map;
  }, [worldGeo]);

  const handleCountryClick = (iso: string) => {
    if (iso in DRILLDOWN_COUNTRIES) {
      setSelectedCountry(iso as DrillDownCountry);
    }
  };

  return (
    <div className="chart-card" style={{ marginBottom: 24 }}>
      <div className="chart-card__header">
        <div>
          <h3 style={{ margin: 0 }}>
            {selectedCountry
              ? DRILLDOWN_COUNTRIES[selectedCountry]
              : "User Locations"}
          </h3>
          {!loading && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              {selectedCountry
                ? `${stateCounts.size} regions`
                : `${totalLocated} users across ${countriesRepresented} countries`}
            </p>
          )}
        </div>
        {selectedCountry && (
          <button
            className="ghost-btn"
            onClick={() => setSelectedCountry(null)}
          >
            &#8592; Back to World
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p style={{ padding: 16, color: "var(--muted)" }}>
          Loading location data...
        </p>
      ) : profiles.length === 0 ? (
        <p style={{ padding: 16, color: "var(--muted)" }}>
          No location data available.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 200px",
            gap: 16,
            padding: "12px 16px 16px",
          }}
        >
          {/* Map area */}
          <div style={{ position: "relative" }}>
            {!selectedCountry ? (
              <WorldMapSvg
                geoJson={worldGeo}
                counts={countryCounts}
                maxCount={maxCountryCount}
                onCountryClick={handleCountryClick}
                onHover={setTooltip}
              />
            ) : (
              <CountryMapSvg
                geoJson={countryGeo}
                counts={stateCounts}
                maxCount={maxStateCount}
                onHover={setTooltip}
              />
            )}

            {/* Tooltip overlay */}
            {tooltip && (
              <div
                style={{
                  position: "absolute",
                  left: tooltip.x + 12,
                  top: tooltip.y - 8,
                  background: "#1e2128",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  pointerEvents: "none",
                  zIndex: 5,
                  whiteSpace: "nowrap",
                }}
              >
                <strong>{tooltip.name}</strong>
                <br />
                {tooltip.count} user{tooltip.count !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Side stats panel */}
          <div>
            <div
              style={{
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              {selectedCountry ? "Top Regions" : "Top Countries"}
            </div>
            {topEntries.map(([key, count], idx) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginRight: 8,
                  }}
                >
                  {selectedCountry
                    ? key
                    : countryNames.get(key) ?? key}
                </span>
                <span
                  style={{
                    color: BAR_COLORS[idx % BAR_COLORS.length],
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
            {topEntries.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                No data
              </p>
            )}

            {/* Color legend */}
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              Density
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 4,
                marginTop: 4,
                background:
                  "linear-gradient(to right, #2c3039, #5a5f6e, #8b7040, #ffa500)",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 2,
              }}
            >
              <span>0</span>
              <span>{selectedCountry ? maxStateCount : maxCountryCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

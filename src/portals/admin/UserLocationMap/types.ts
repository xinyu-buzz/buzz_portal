export type LocationProfile = {
  id: string;
  last_location_lat: number;
  last_location_lng: number;
  last_location_update: string | null;
  selected_region: string | null;
};

export type GeoGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type GeoFeature = {
  type: "Feature";
  properties: {
    ISO_A3?: string;
    ISO_A2?: string;
    NAME: string;
    NAME_1?: string;
    ISO_3166_2?: string;
    [key: string]: unknown;
  };
  geometry: GeoGeometry;
};

export type GeoJson = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type DrillDownCountry =
  | "USA"
  | "CAN"
  | "GBR"
  | "AUS"
  | "NZL"
  | "ZAF";

export const DRILLDOWN_COUNTRIES: Record<DrillDownCountry, string> = {
  USA: "United States",
  CAN: "Canada",
  GBR: "United Kingdom",
  AUS: "Australia",
  NZL: "New Zealand",
  ZAF: "South Africa",
};

export const DRILLDOWN_FILES: Record<DrillDownCountry, string> = {
  USA: "/geo/states-usa.json",
  CAN: "/geo/provinces-canada.json",
  GBR: "/geo/regions-uk.json",
  AUS: "/geo/states-australia.json",
  NZL: "/geo/regions-nz.json",
  ZAF: "/geo/provinces-south-africa.json",
};

export type TooltipData = {
  name: string;
  count: number;
  x: number;
  y: number;
};

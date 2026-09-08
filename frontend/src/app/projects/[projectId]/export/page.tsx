"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";
import { getBuildings, getExportUrl } from "@/lib/api/buildings";
import { Project, GeoJSONFeatureCollection } from "@/types";
import {
  Download,
  FileJson,
  FileArchive,
  Database,
  CheckCircle2,
  Loader2,
  Map,
  BarChart3,
  AlertTriangle,
  Package,
} from "lucide-react";

type ExportFormat = "geojson" | "shp" | "gpkg";

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("geojson");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [proj, buildings] = await Promise.all([
          getProject(projectId),
          getBuildings(projectId),
        ]);
        setProject(proj);
        setGeojson(buildings);
      } catch (err: any) {
        setError(err.message || "Failed to load export data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const stats = useMemo(() => {
    if (!geojson) return { total: 0, approved: 0, edited: 0, rejected: 0, needsReview: 0, exportable: 0 };
    const features = geojson.features || [];
    const approved = features.filter((f) => f.properties?.review_status === "approved").length;
    const edited = features.filter((f) => f.properties?.review_status === "edited").length;
    const rejected = features.filter((f) => f.properties?.review_status === "rejected").length;
    const needsReview = features.length - approved - edited - rejected;
    const exportable = features.length - rejected;
    return { total: features.length, approved, edited, rejected, needsReview, exportable };
  }, [geojson]);

  const handleExport = () => {
    setExporting(true);
    const url = getExportUrl(projectId, selectedFormat);
    // Use a hidden anchor to trigger download
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project?.name || "export"}.${selectedFormat === "shp" ? "zip" : selectedFormat}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => setExporting(false), 2000);
  };

  const formats: { id: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: "geojson",
      label: "GeoJSON",
      description: "Standard open geospatial format. Compatible with QGIS, MapLibre, Leaflet.",
      icon: <FileJson className="h-6 w-6" />,
    },
    {
      id: "shp",
      label: "ESRI Shapefile",
      description: "Industry-standard format for ArcGIS and legacy GIS systems. Downloaded as .zip.",
      icon: <FileArchive className="h-6 w-6" />,
    },
    {
      id: "gpkg",
      label: "GeoPackage",
      description: "Modern, portable SQLite-based GIS format. Supports complex attributes.",
      icon: <Package className="h-6 w-6" />,
    },
  ];

  if (loading) {
    return (
      <div className="w-full flex flex-col min-h-full">
        <div className="bg-white w-full border-b border-hairline pt-10 pb-8 px-8">
          <div className="max-w-[1440px] mx-auto">
            <div className="h-4 w-32 bg-grid-wash rounded animate-pulse mb-3"></div>
            <div className="h-8 w-64 bg-grid-wash rounded animate-pulse"></div>
          </div>
        </div>
        <div className="w-full bg-paper flex-1 py-12 px-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white border border-hairline rounded-[6px] animate-pulse"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-full py-24">
        <AlertTriangle className="h-10 w-10 text-conflict-rust mb-4" />
        <h2 className="text-body font-semibold text-survey-navy mb-2">Export Unavailable</h2>
        <p className="text-caption text-instrument-gray">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white w-full border-b border-hairline pt-10 pb-8 px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-2">
              <Download className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
              Data Export
            </span>
            <h1 className="text-display-sm font-semibold text-survey-navy tracking-display-sm">
              Export Validated GIS Data
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}/review`)}
              className="flex items-center gap-2 border border-hairline hover:border-survey-navy text-survey-navy px-[16px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors bg-white"
            >
              <Map className="h-4 w-4" />
              GIS Workspace
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}/results`)}
              className="flex items-center gap-2 border border-hairline hover:border-survey-navy text-survey-navy px-[16px] py-[10px] rounded-[4px] text-[14px] font-medium transition-colors bg-white"
            >
              <BarChart3 className="h-4 w-4" />
              Results
            </button>
          </div>
        </div>
      </div>

      {/* Export Content */}
      <div className="w-full bg-paper flex-1 py-12 px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Export Summary */}
          <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-4">
              Export Summary
            </span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <span className="text-caption text-instrument-gray block">Total</span>
                <span className="text-heading-sm font-semibold text-survey-navy font-plex-mono">{stats.total}</span>
              </div>
              <div className="space-y-1">
                <span className="text-caption text-instrument-gray block">Approved</span>
                <span className="text-heading-sm font-semibold text-verified-green font-plex-mono">{stats.approved}</span>
              </div>
              <div className="space-y-1">
                <span className="text-caption text-instrument-gray block">Edited</span>
                <span className="text-heading-sm font-semibold text-deep-chart font-plex-mono">{stats.edited}</span>
              </div>
              <div className="space-y-1">
                <span className="text-caption text-instrument-gray block">Rejected</span>
                <span className="text-heading-sm font-semibold text-conflict-rust font-plex-mono">{stats.rejected}</span>
              </div>
              <div className="space-y-1">
                <span className="text-caption text-instrument-gray block">Exportable</span>
                <span className="text-heading-sm font-semibold text-survey-navy font-plex-mono">{stats.exportable}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-hairline text-caption text-instrument-gray flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-verified-green" />
              Rejected features are excluded from all exports. Human-edited geometry takes precedence over AI geometry.
            </div>
          </div>

          {/* Format Selector */}
          <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-4">
              Select Format
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {formats.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`text-left p-4 rounded-[6px] border-2 transition-all ${
                    selectedFormat === fmt.id
                      ? "border-survey-navy bg-paper"
                      : "border-hairline hover:border-instrument-gray"
                  }`}
                >
                  <div className={`mb-3 ${selectedFormat === fmt.id ? "text-survey-navy" : "text-instrument-gray"}`}>
                    {fmt.icon}
                  </div>
                  <h3 className={`text-body font-semibold ${selectedFormat === fmt.id ? "text-survey-navy" : "text-instrument-gray"}`}>
                    {fmt.label}
                  </h3>
                  <p className="text-caption text-instrument-gray mt-1 leading-relaxed">
                    {fmt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-white border border-hairline rounded-[6px] p-6 shadow-xs">
            <span className="text-caption text-fog font-plex-mono uppercase tracking-wider block mb-4">
              Dataset Details
            </span>
            <div className="grid grid-cols-2 gap-4 text-caption font-plex-mono">
              <div>
                <span className="text-instrument-gray block mb-1">CRS</span>
                <span className="text-survey-navy font-medium">{project.crs || "EPSG:4326"}</span>
              </div>
              <div>
                <span className="text-instrument-gray block mb-1">Geometry Type</span>
                <span className="text-survey-navy font-medium">Polygon</span>
              </div>
              <div>
                <span className="text-instrument-gray block mb-1">Features</span>
                <span className="text-survey-navy font-medium">{stats.exportable} validated structures</span>
              </div>
              <div>
                <span className="text-instrument-gray block mb-1">Format</span>
                <span className="text-survey-navy font-medium">{formats.find(f => f.id === selectedFormat)?.label}</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-center pb-8">
            <button
              onClick={handleExport}
              disabled={exporting || stats.exportable === 0}
              className="px-10 py-3 bg-survey-navy hover:bg-deep-chart text-white font-medium rounded-[4px] transition-colors flex items-center gap-3 shadow-md disabled:opacity-60 text-body"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Preparing Export...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Export {stats.exportable} Features as {formats.find(f => f.id === selectedFormat)?.label}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { Project } from "@/types";
import { useBuildings } from "@/hooks/useBuildings";
import { getExportUrl } from "@/lib/api/buildings";
import {
  Download,
  Building,
  Scale,
  Percent,
  CheckCircle,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  XCircle,
  AlertTriangle,
  X,
  FileCheck
} from "lucide-react";

interface ResultsDashboardProps {
  project: Project;
}

export default function ResultsDashboard({ project }: ResultsDashboardProps) {
  const { geojson, loading, error } = useBuildings(project.id);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<"geojson" | "shp" | "gpkg" | null>(null);

  // Compute metrics dynamically from WGS84 GeoJSON, including human review statuses
  const stats = useMemo(() => {
    if (!geojson || geojson.features.length === 0) {
      return { total: 0, totalArea: 0, avgConfidence: 0, approved: 0, edited: 0, rejected: 0, needsReview: 0, rawTotal: 0 };
    }

    let approved = 0;
    let edited = 0;
    let rejected = 0;
    let needsReview = 0;
    let sumArea = 0;
    let sumConf = 0;
    let validCount = 0;

    geojson.features.forEach((f) => {
      const status = f.properties.review_status;
      if (status === "approved" || status === "APPROVED") approved++;
      else if (status === "edited" || status === "EDITED") edited++;
      else if (status === "rejected" || status === "REJECTED") rejected++;
      else if (status === "needs_review" || status === "NEEDS_REVIEW") needsReview++;

      // Only calculate final statistics using non-rejected building polygons
      if (status !== "rejected" && status !== "REJECTED") {
        sumArea += f.properties.area || 0;
        sumConf += f.properties.confidence || 0;
        validCount++;
      }
    });

    return {
      total: validCount, // final validated building counts
      totalArea: sumArea,
      avgConfidence: validCount > 0 ? (sumConf / validCount) * 100 : 0,
      approved,
      edited,
      rejected,
      needsReview,
      rawTotal: geojson.features.length
    };
  }, [geojson]);

  const handleExportTrigger = (format: "geojson" | "shp" | "gpkg") => {
    setExportFormat(format);
    setShowSummaryModal(true);
  };

  const executeDownload = () => {
    if (!exportFormat) return;
    
    // Build direct backend download link
    const downloadUrl = getExportUrl(project.id, exportFormat);
    
    // Create an invisible anchor tag to trigger the browser file download
    const link = document.createElement("a");
    link.href = downloadUrl;
    // Set target blank to prevent page navigation on failure
    link.setAttribute("target", "_blank");
    link.click();
    
    setShowSummaryModal(false);
    setExportFormat(null);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { text: "Completed", color: "text-verified-green bg-[#e7f4ec] border-verified-green/30" };
      case "FAILED":
        return { text: "Failed", color: "text-conflict-rust bg-rust-wash border-conflict-rust/30" };
      default:
        return { text: "In Progress", color: "text-survey-navy bg-grid-wash border-survey-navy/30" };
    }
  };

  const statusBadge = getStatusLabel(project.status);

  return (
    <div className="space-y-8 relative">
      {/* Overview Block */}
      <div className="bg-white border border-hairline rounded-[6px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="bg-[#e7f4ec] border border-verified-green/30 p-3 rounded-[6px] text-verified-green shrink-0">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-survey-navy flex items-center gap-3">
              Extraction Completed
              <span className={`text-caption px-2 py-0.5 rounded-[3px] border font-plex-mono tracking-wider font-semibold uppercase ${statusBadge.color}`}>
                {statusBadge.text}
              </span>
            </h2>
            <p className="text-instrument-gray text-body mt-1">
              AI Building Footprint extraction has finished. Review metrics and download spatial formats below.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Buildings Detected */}
        <div className="bg-white border border-hairline p-6 rounded-[6px] relative overflow-hidden group hover:border-survey-navy transition-colors flex flex-col justify-between h-36 shadow-xs">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block font-plex-mono border-b border-hairline pb-2">
            Validated Buildings
          </span>
          {loading ? (
            <div className="h-8 w-24 bg-paper rounded-[4px] animate-pulse my-2"></div>
          ) : (
            <span className="text-[32px] font-bold text-survey-navy my-2 font-plex-mono">
              {stats.total} <span className="text-[14px] text-fog font-medium">/ {stats.rawTotal}</span>
            </span>
          )}
          <span className="text-instrument-gray text-caption flex items-center gap-1.5 font-medium">
            <Building className="h-4 w-4 text-survey-navy" />
            Excluding rejected predictions
          </span>
        </div>

        {/* Card 2: Total Building Area */}
        <div className="bg-white border border-hairline p-6 rounded-[6px] relative overflow-hidden group hover:border-survey-navy transition-colors flex flex-col justify-between h-36 shadow-xs">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block font-plex-mono border-b border-hairline pb-2">
            Total Built-Up Area
          </span>
          {loading ? (
            <div className="h-8 w-24 bg-paper rounded-[4px] animate-pulse my-2"></div>
          ) : (
            <span className="text-[32px] font-bold text-survey-navy my-2 font-plex-mono">
              {stats.totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²
            </span>
          )}
          <span className="text-instrument-gray text-caption flex items-center gap-1.5 font-plex-mono font-medium">
            <Scale className="h-4 w-4 text-survey-navy" />
            {(stats.totalArea / 10000).toFixed(3)} hectares
          </span>
        </div>

        {/* Card 3: Average Confidence */}
        <div className="bg-white border border-hairline p-6 rounded-[6px] relative overflow-hidden group hover:border-survey-navy transition-colors flex flex-col justify-between h-36 shadow-xs">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider block font-plex-mono border-b border-hairline pb-2">
            Mean AI Confidence
          </span>
          {loading ? (
            <div className="h-8 w-24 bg-paper rounded-[4px] animate-pulse my-2"></div>
          ) : (
            <span className="text-[32px] font-bold text-verified-green my-2 font-plex-mono">
              {stats.avgConfidence.toFixed(1)}%
            </span>
          )}
          <span className="text-instrument-gray text-caption flex items-center gap-1.5 font-medium">
            <Percent className="h-4 w-4 text-survey-navy" />
            Mean pixel probability
          </span>
        </div>
      </div>

      {/* Exporters and Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Spatial Exporters Card (Left column - 3/5 width) */}
        <div className="lg:col-span-3 bg-white border border-hairline rounded-[6px] p-6 space-y-6 flex flex-col justify-between shadow-xs">
          <div className="space-y-2 border-b border-hairline pb-4">
            <h3 className="font-semibold text-survey-navy text-[18px]">Export Feature Data</h3>
            <p className="text-instrument-gray text-body">
              Export extraction shapes in standard vector datasets for importing into GIS software (QGIS, ArcGIS).
            </p>
          </div>

          <div className="space-y-4">
            {/* GeoJSON Export */}
            <button
              onClick={() => handleExportTrigger("geojson")}
              disabled={loading || stats.total === 0}
              className="w-full flex items-center justify-between p-4 rounded-[6px] border border-survey-navy/40 bg-grid-wash hover:bg-grid-wash/80 text-survey-navy font-semibold text-[14px] transition-colors shadow-xs group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-[4px] border border-hairline text-survey-navy shadow-xs">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-survey-navy">Export Validated GeoJSON</p>
                  <p className="text-caption text-instrument-gray font-medium mt-0.5 font-plex-mono">WGS84 Coordinates (EPSG:4326)</p>
                </div>
              </div>
              <Download className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* Shapefile Export */}
            <button
              onClick={() => handleExportTrigger("shp")}
              disabled={loading || stats.total === 0}
              className="w-full flex items-center justify-between p-4 rounded-[6px] border border-survey-navy/40 bg-grid-wash hover:bg-grid-wash/80 text-survey-navy font-semibold text-[14px] transition-colors shadow-xs group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-[4px] border border-hairline text-survey-navy shadow-xs">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-survey-navy">Export ESRI Shapefile</p>
                  <p className="text-caption text-instrument-gray font-medium mt-0.5 font-plex-mono">Zipped Bundle (.shp, .dbf, .shx, .prj)</p>
                </div>
              </div>
              <Download className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* GeoPackage Export */}
            <button
              onClick={() => handleExportTrigger("gpkg")}
              disabled={loading || stats.total === 0}
              className="w-full flex items-center justify-between p-4 rounded-[6px] border border-survey-navy/40 bg-grid-wash hover:bg-grid-wash/80 text-survey-navy font-semibold text-[14px] transition-colors shadow-xs group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-[4px] border border-hairline text-survey-navy shadow-xs">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-survey-navy">Export GeoPackage (GPKG)</p>
                  <p className="text-caption text-instrument-gray font-medium mt-0.5 font-plex-mono">SQLite-based standard format (.gpkg)</p>
                </div>
              </div>
              <Download className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Feature status (Right column - 2/5 width) */}
        <div className="lg:col-span-2 bg-white border border-hairline rounded-[6px] p-6 space-y-5 shadow-xs">
          <span className="text-caption text-instrument-gray font-bold uppercase tracking-wider font-plex-mono block border-b border-hairline pb-3">
            Building QA Summary (HIL)
          </span>

          <div className="space-y-4 text-[14px] pt-1">
            {/* Raw Detected */}
            <div className="flex items-center justify-between text-instrument-gray font-medium">
              <span>Total AI Predictions:</span>
              <span className="font-bold text-survey-navy font-plex-mono">{stats.rawTotal}</span>
            </div>
            
            {/* Needs Review */}
            <div className="flex items-center justify-between text-instrument-gray font-medium">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-review-amber" /> Needs QA Review:
              </span>
              <span className="font-bold text-review-amber font-plex-mono">{stats.needsReview}</span>
            </div>

            {/* Approved */}
            <div className="flex items-center justify-between text-instrument-gray font-medium">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-verified-green" /> Approved Shapes:
              </span>
              <span className="font-bold text-verified-green font-plex-mono">{stats.approved}</span>
            </div>

            {/* Edited */}
            <div className="flex items-center justify-between text-instrument-gray font-medium">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-survey-navy" /> Aligned (Edited) Shapes:
              </span>
              <span className="font-bold text-survey-navy font-plex-mono">{stats.edited}</span>
            </div>

            {/* Rejected */}
            <div className="flex items-center justify-between text-instrument-gray font-medium">
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-conflict-rust" /> Discarded (Rejected):
              </span>
              <span className="font-bold text-conflict-rust font-plex-mono">{stats.rejected}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-hairline rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-grid-wash border-b border-hairline px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-survey-navy flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-survey-navy" />
                Prepare Vector Export
              </h3>
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  setExportFormat(null);
                }}
                className="text-instrument-gray hover:text-survey-navy p-1 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="text-[13px] text-instrument-gray leading-relaxed">
                Confirming geospatial export parameters for survey <strong className="text-survey-navy">{project.name}</strong>. 
                Rejected building footprints will be excluded from the final vector layer.
              </div>

              {/* Stats parameters table */}
              <div className="border border-hairline rounded-[6px] divide-y divide-hairline bg-paper text-[13px] font-plex-mono">
                <div className="flex justify-between p-3">
                  <span className="text-instrument-gray">Export Format:</span>
                  <span className="text-survey-navy font-bold uppercase">{exportFormat}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-instrument-gray">Spatial Geometry:</span>
                  <span className="text-survey-navy font-semibold">Polygon</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-instrument-gray">Reference System:</span>
                  <span className="text-survey-navy font-semibold">{project.crs || "EPSG:4326"}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-instrument-gray">Total Features:</span>
                  <span className="text-survey-navy font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between p-3 text-verified-green bg-[#e7f4ec]/30">
                  <span className="font-medium">Approved / Edited:</span>
                  <span className="font-bold">{stats.approved + stats.edited}</span>
                </div>
                <div className="flex justify-between p-3 text-conflict-rust bg-rust-wash/30">
                  <span className="font-medium">Excluded (Rejected):</span>
                  <span className="font-bold">{stats.rejected}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowSummaryModal(false);
                    setExportFormat(null);
                  }}
                  className="flex-1 bg-white hover:bg-grid-wash text-survey-navy border border-hairline py-2.5 rounded-[4px] text-[13px] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDownload}
                  className="flex-1 bg-survey-navy hover:bg-deep-chart text-white py-2.5 rounded-[4px] text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  Generate & Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

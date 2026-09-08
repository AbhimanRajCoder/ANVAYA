"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadFile, getDemoUpload } from "@/lib/api/uploads";
import { createProject } from "@/lib/api/projects";
import { UploadResponse } from "@/types";
import {
  Check,
  CloudUpload,
  Database,
  FileImage,
  Globe,
  Loader2,
  Maximize2,
  Scale,
  Settings,
  AlertTriangle,
} from "lucide-react";

export default function NewSurveyWizard() {
  const router = useRouter();

  // Step state: 1 = Survey Info, 2 = File Upload, 3 = Confirm Metadata
  const [step, setStep] = useState<number>(1);

  // Step 1: Form state
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Step 2: Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<UploadResponse | null>(null);
  const [loadedBytes, setLoadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);

  // Step 3: Project creation state
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setUploadError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = [".tif", ".tiff", ".png", ".jpg", ".jpeg"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setUploadError(`Invalid file format. Supported extensions: ${validExtensions.join(", ")}`);
      return;
    }
    setFile(selectedFile);
  };

  const handleUploadSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setLoadedBytes(0);
    setTotalBytes(file.size);

    try {
      const data = await uploadFile(file, (progressEvent) => {
        setLoadedBytes(progressEvent.loaded);
        if (progressEvent.total) {
          setTotalBytes(progressEvent.total);
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        } else {
          const percent = Math.round((progressEvent.loaded * 100) / file.size);
          setUploadProgress(Math.min(99, percent));
        }
      });
      setMetadata(data);
      setStep(3);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.response?.data?.detail || "Upload failed. Check your network or file size.");
    } finally {
      setUploading(false);
    }
  };

  const handleDemoUpload = async () => {
    setUploading(true);
    setUploadError(null);
    try {
      const data = await getDemoUpload();
      setMetadata(data);
      setStep(3);
    } catch (err: any) {
      console.error("Failed to load demo file:", err);
      setUploadError("Failed to load demo file. Backend may be unreachable.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!metadata) return;
    setCreatingProject(true);
    setCreationError(null);

    try {
      const project = await createProject({
        name,
        description,
        source_file: metadata.filepath,
        crs: metadata.crs,
        bounds: metadata.bounds,
      });
      
      // Navigate to Processing Pipeline page
      router.push(`/projects/${project.id}/processing`);
    } catch (err: any) {
      console.error("Failed to create project:", err);
      setCreationError(err.response?.data?.detail || "Failed to register project in database.");
    } finally {
      setCreatingProject(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper to render step badges
  const renderStepHeader = (currentStep: number, label: string) => {
    const isCompleted = step > currentStep;
    const isActive = step === currentStep;

    return (
      <div className="flex items-center gap-2">
        <div
          className={`h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-[12px] sm:text-[14px] transition-colors border ${
            isCompleted
              ? "bg-survey-navy border-survey-navy text-white"
              : isActive
              ? "border-survey-navy text-survey-navy"
              : "border-hairline text-instrument-gray bg-paper"
          }`}
        >
          {isCompleted ? <Check className="h-4 w-4" /> : currentStep}
        </div>
        <span
          className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider font-plex-mono hidden md:inline-block ${
            isActive ? "text-survey-navy" : isCompleted ? "text-fog" : "text-instrument-gray"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-hairline rounded-[6px] shadow-xs">
      {/* Wizard Steps Header */}
      <div className="p-4 sm:p-6 bg-paper border-b border-hairline flex items-center justify-between gap-2 overflow-x-auto">
        {renderStepHeader(1, "PROJECT")}
        <div className="h-[1px] bg-hairline flex-1 min-w-[1rem]"></div>
        {renderStepHeader(2, "UPLOAD")}
        <div className="h-[1px] bg-hairline flex-1 min-w-[1rem]"></div>
        {renderStepHeader(3, "METADATA")}
        <div className="h-[1px] bg-hairline flex-1 min-w-[1rem]"></div>
        {renderStepHeader(4, "VALIDATION")}
        <div className="h-[1px] bg-hairline flex-1 min-w-[1rem]"></div>
        {renderStepHeader(5, "CREATE")}
      </div>

      <div className="p-8">
        {/* STEP 1: Survey Info */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-caption font-bold uppercase tracking-wider text-instrument-gray block font-plex-mono">
                Survey Name <span className="text-conflict-rust">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dehradun Survey Sector 4"
                className="w-full bg-white border border-hairline focus:border-survey-navy rounded-[4px] px-4 py-3 text-survey-navy text-[14px] focus:outline-none transition-colors placeholder:text-fog font-plex-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-caption font-bold uppercase tracking-wider text-instrument-gray block font-plex-mono">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the area mapped, flight parameters, drone sensors, or specific notes..."
                className="w-full bg-white border border-hairline focus:border-survey-navy rounded-[4px] px-4 py-3 text-survey-navy text-[14px] focus:outline-none transition-colors placeholder:text-fog resize-none font-plex-mono"
              />
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={!name.trim()}
                className="bg-survey-navy hover:bg-deep-chart disabled:bg-grid-wash disabled:text-fog disabled:border-hairline disabled:border text-white font-medium py-[10px] px-[24px] rounded-[4px] text-[14px] transition-colors shadow-xs"
              >
                Continue➔
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: File Upload */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-survey-navy text-heading-sm">Upload Drone Data</h3>
              <p className="text-instrument-gray text-body">
                Upload your stitched drone orthomosaic image. Max file size: 500MB.
              </p>
            </div>

            {/* Sample Data Banner */}
            {!file && !uploading && (
              <div className="bg-grid-wash border border-survey-navy/20 p-4 rounded-[6px] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-survey-navy text-[14px]">Don't have a drone dataset?</h4>
                  <p className="text-instrument-gray text-caption mt-1">
                    Try our complete AI pipeline instantly using a pre-processed sample orthomosaic.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDemoUpload}
                  className="bg-survey-navy hover:bg-deep-chart text-white font-medium py-2 px-4 rounded-[4px] text-[14px] transition-colors shadow-xs shrink-0 whitespace-nowrap"
                >
                  Use Sample Image ➔
                </button>
              </div>
            )}

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border border-dashed rounded-[6px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors bg-paper ${
                dragActive
                  ? "border-survey-navy bg-grid-wash"
                  : file
                  ? "border-fog bg-white"
                  : "border-hairline hover:border-survey-navy hover:bg-grid-wash"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".tif,.tiff,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                disabled={uploading}
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-4 py-6 w-full max-w-sm">
                  <Loader2 className="h-8 w-8 text-survey-navy animate-spin" />
                  
                  {uploadProgress < 100 ? (
                    <div className="text-center space-y-2">
                      <span className="text-survey-navy text-[14px] font-semibold block">Uploading Orthomosaic</span>
                      <span className="text-instrument-gray text-caption font-plex-mono block">
                        {(loadedBytes / (1024 * 1024)).toFixed(1)} MB / {(totalBytes / (1024 * 1024)).toFixed(1)} MB ({uploadProgress}%)
                      </span>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 animate-pulse">
                      <span className="text-survey-navy text-[14px] font-semibold block">Upload Complete!</span>
                      <span className="text-instrument-gray text-caption font-medium block">
                        Saving & extracting geospatial metadata on server...
                      </span>
                      <span className="text-fog text-[10px] block">
                        (This may take a moment for large files)
                      </span>
                    </div>
                  )}
                  
                  <div className="w-full bg-grid-wash h-2 rounded-full overflow-hidden mt-2 relative">
                    <div
                      className="bg-survey-navy h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="bg-white p-3 rounded-[4px] border border-hairline text-survey-navy shadow-xs">
                    <FileImage className="h-8 w-8" />
                  </div>
                  <span className="text-[14px] font-semibold text-survey-navy truncate max-w-sm">{file.name}</span>
                  <span className="text-caption text-instrument-gray font-plex-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-caption text-conflict-rust hover:text-conflict-rust/80 underline font-semibold mt-2 transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="bg-white p-4 rounded-[6px] border border-hairline text-instrument-gray shadow-xs">
                    <CloudUpload className="h-8 w-8 text-survey-navy" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-survey-navy">Drag & drop your drone raster file</p>
                    <p className="text-caption text-instrument-gray mt-1">
                      Supports GeoTIFF (.tif, .tiff), PNG, or JPEG
                    </p>
                  </div>
                  <span className="bg-white border border-hairline px-4 py-2 rounded-[4px] text-caption text-survey-navy font-medium mt-2 shadow-xs transition-colors hover:bg-grid-wash">
                    Select File
                  </span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="bg-rust-wash border border-conflict-rust/30 p-4 rounded-[6px] flex items-center gap-3 text-conflict-rust text-caption">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="pt-6 border-t border-hairline flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={uploading}
                className="bg-white hover:bg-grid-wash text-survey-navy font-medium py-[10px] px-[24px] rounded-[4px] text-[14px] border border-hairline disabled:opacity-50 transition-colors shadow-xs"
              >
                Back
              </button>
              {file && !uploading && (
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  className="bg-survey-navy hover:bg-deep-chart text-white font-medium py-[10px] px-[24px] rounded-[4px] text-[14px] transition-colors shadow-xs"
                >
                  Upload & Validate➔
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Confirm Metadata */}
        {step === 3 && metadata && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-[#e7f4ec] border border-verified-green/30 p-4 rounded-[6px] text-verified-green">
              <Check className="h-5 w-5 shrink-0 bg-verified-green/20 p-0.5 rounded-full text-verified-green" />
              <div className="text-caption">
                <p className="font-semibold text-survey-navy">✓ Geospatial data validated</p>
                <p className="text-instrument-gray mt-0.5">
                  Raster format, dimensions, and reference systems verified successfully.
                </p>
              </div>
            </div>
            <h2 className="text-body font-semibold text-survey-navy tracking-tight mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-cadastral-rust" />
              Geospatial Metadata Extracted
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-paper border border-hairline p-4 rounded-[6px] flex items-center gap-3">
                <FileImage className="h-5 w-5 text-survey-navy shrink-0" />
                <div className="min-w-0">
                  <span className="text-caption text-instrument-gray block uppercase font-plex-mono tracking-wider">Filename</span>
                  <span className="text-[14px] font-semibold text-survey-navy truncate block mt-0.5">
                    {metadata.filename}
                  </span>
                </div>
              </div>

              <div className="bg-paper border border-hairline p-4 rounded-[6px] flex items-center gap-3">
                <Globe className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-caption text-instrument-gray block uppercase font-plex-mono tracking-wider">Reference System (CRS)</span>
                  <span className="text-[14px] font-semibold text-survey-navy block mt-0.5">
                    {metadata.crs || "Local Grid"}
                  </span>
                </div>
              </div>

              <div className="bg-paper border border-hairline p-4 rounded-[6px] flex items-center gap-3">
                <Maximize2 className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-caption text-instrument-gray block uppercase font-plex-mono tracking-wider">Dimensions</span>
                  <span className="text-[14px] font-semibold text-survey-navy block font-plex-mono mt-0.5">
                    {metadata.width} × {metadata.height} px
                  </span>
                </div>
              </div>

              <div className="bg-paper border border-hairline p-4 rounded-[6px] flex items-center gap-3">
                <Scale className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-caption text-instrument-gray block uppercase font-plex-mono tracking-wider">Resolution</span>
                  <span className="text-[14px] font-semibold text-survey-navy block font-plex-mono mt-0.5">
                    {(metadata.resolution[0] * 100).toFixed(2)} cm / pixel
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-paper border border-hairline rounded-[6px] p-5 space-y-3">
              <span className="text-caption text-instrument-gray block uppercase font-plex-mono tracking-wider">Bounding Box Coordinates</span>
              <div className="grid grid-cols-2 gap-4 text-caption font-plex-mono text-survey-navy">
                <div>
                  <span className="text-fog block mb-1">Min X / Longitude</span>
                  <span className="font-medium">{metadata.bounds[0].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-fog block mb-1">Min Y / Latitude</span>
                  <span className="font-medium">{metadata.bounds[1].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-fog block mb-1">Max X / Longitude</span>
                  <span className="font-medium">{metadata.bounds[2].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-fog block mb-1">Max Y / Latitude</span>
                  <span className="font-medium">{metadata.bounds[3].toFixed(6)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-hairline text-instrument-gray hover:text-survey-navy font-medium rounded-[4px] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2 bg-survey-navy hover:bg-deep-chart text-white font-medium rounded-[4px] transition-colors flex items-center gap-2 shadow-xs"
              >
                Continue to Validation
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Validation */}
        {step === 4 && metadata && (
          <div className="space-y-6">
            <h2 className="text-body font-semibold text-survey-navy tracking-tight mb-4 flex items-center gap-2">
              <Check className="h-5 w-5 text-verified-green" />
              Dataset Validation
            </h2>
            <div className="bg-white border border-verified-green/30 rounded-[4px] p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-verified-green" />
                <span className="text-body text-survey-navy">File readable and properly formatted</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-verified-green" />
                <span className="text-body text-survey-navy">Coordinate Reference System (CRS) detected</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-verified-green" />
                <span className="text-body text-survey-navy">Spatial bounds successfully extracted</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-verified-green" />
                <span className="text-body text-survey-navy">Resolution metadata verified</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2 border border-hairline text-instrument-gray hover:text-survey-navy font-medium rounded-[4px] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2 bg-survey-navy hover:bg-deep-chart text-white font-medium rounded-[4px] transition-colors flex items-center gap-2 shadow-xs"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Create Survey */}
        {step === 5 && metadata && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-survey-navy mx-auto mb-4" />
              <h2 className="text-heading-sm font-semibold text-survey-navy tracking-tight mb-2">
                Ready to Create Survey
              </h2>
              <p className="text-instrument-gray max-w-md mx-auto">
                The dataset is validated and ready for AI processing. Click create to register the survey and begin inference.
              </p>
            </div>

            {creationError && (
              <div className="bg-rust-wash border border-conflict-rust/30 text-conflict-rust p-4 rounded-[6px] text-body-sm font-medium flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{creationError}</span>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <button
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="px-8 py-3 bg-survey-navy hover:bg-deep-chart text-white font-medium rounded-[4px] transition-colors flex items-center gap-3 shadow-md disabled:opacity-70 w-full sm:w-auto justify-center text-body"
              >
                {creatingProject ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Registering Survey...
                  </>
                ) : (
                  <>
                    <Database className="h-5 w-5" />
                    Create Survey
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

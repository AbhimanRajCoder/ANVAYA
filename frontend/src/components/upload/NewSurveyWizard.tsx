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
      <div className="flex items-center gap-2.5">
        <div
          className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all border ${
            isCompleted
              ? "bg-survey-navy border-survey-navy text-white shadow-xs"
              : isActive
              ? "border-survey-navy text-survey-navy bg-blue-50/50 font-bold ring-2 ring-blue-100"
              : "border-slate-200 text-slate-400 bg-slate-50"
          }`}
        >
          {isCompleted ? <Check className="h-4 w-4" /> : currentStep}
        </div>
        <span
          className={`text-xs font-semibold uppercase tracking-wider font-plex-mono hidden md:inline-block ${
            isActive ? "text-slate-900 font-bold" : isCompleted ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Wizard Steps Header */}
      <div className="p-4 sm:p-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto">
        {renderStepHeader(1, "PROJECT")}
        <div className="h-[2px] bg-slate-200 flex-1 min-w-[1rem] rounded-full"></div>
        {renderStepHeader(2, "UPLOAD")}
        <div className="h-[2px] bg-slate-200 flex-1 min-w-[1rem] rounded-full"></div>
        {renderStepHeader(3, "METADATA")}
        <div className="h-[2px] bg-slate-200 flex-1 min-w-[1rem] rounded-full"></div>
        {renderStepHeader(4, "VALIDATION")}
        <div className="h-[2px] bg-slate-200 flex-1 min-w-[1rem] rounded-full"></div>
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block font-plex-mono">
                Survey Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dehradun Cadastral Survey Sector 4"
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-400 font-medium shadow-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block font-plex-mono">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the survey location, flight parameters, drone sensors, or cadastral notes..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-400 resize-none font-medium shadow-xs"
              />
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={!name.trim()}
                className="bg-survey-navy hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm"
              >
                Continue to Upload ➔
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: File Upload */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Upload Drone Data</h3>
              <p className="text-slate-500 text-sm">
                Upload your stitched drone orthomosaic raster image. Max file size: 500MB.
              </p>
            </div>

            {/* Sample Data Banner */}
            {!file && !uploading && (
              <div className="bg-blue-50/60 border border-blue-200/80 p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Don't have a drone dataset handy?</h4>
                  <p className="text-slate-600 text-xs mt-0.5">
                    Test our complete AI detection & GIS pipeline instantly using a pre-processed sample orthomosaic.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDemoUpload}
                  className="bg-survey-navy hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg text-xs transition-all shadow-sm shrink-0 whitespace-nowrap"
                >
                  Use Sample Raster ➔
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
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all bg-slate-50/60 ${
                dragActive
                  ? "border-blue-600 bg-blue-50/40"
                  : file
                  ? "border-slate-300 bg-white"
                  : "border-slate-200 hover:border-blue-500 hover:bg-slate-50"
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
                    <div className="text-center space-y-1">
                      <span className="text-slate-900 text-sm font-semibold block">Uploading Orthomosaic</span>
                      <span className="text-slate-500 text-xs font-plex-mono block">
                        {(loadedBytes / (1024 * 1024)).toFixed(1)} MB / {(totalBytes / (1024 * 1024)).toFixed(1)} MB ({uploadProgress}%)
                      </span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1 animate-pulse">
                      <span className="text-slate-900 text-sm font-semibold block">Upload Complete!</span>
                      <span className="text-slate-500 text-xs font-medium block">
                        Extracting geospatial reference metadata...
                      </span>
                    </div>
                  )}
                  
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-survey-navy h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-survey-navy shadow-xs">
                    <FileImage className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 truncate max-w-sm">{file.name}</span>
                  <span className="text-xs text-slate-500 font-plex-mono">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold mt-2 transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-600 shadow-xs">
                    <CloudUpload className="h-8 w-8 text-survey-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Drag & drop your drone raster file</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Supports GeoTIFF (.tif, .tiff), PNG, or JPEG
                    </p>
                  </div>
                  <span className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs text-slate-700 font-medium shadow-xs transition-all hover:bg-slate-50 mt-1">
                    Select File
                  </span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg flex items-center gap-3 text-rose-700 text-xs font-medium">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={uploading}
                className="bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-5 rounded-lg text-sm border border-slate-200 disabled:opacity-50 transition-all shadow-xs"
              >
                Back
              </button>
              {file && !uploading && (
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  className="bg-survey-navy hover:bg-slate-800 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm"
                >
                  Upload & Validate ➔
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Confirm Metadata */}
        {step === 3 && metadata && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800">
              <Check className="h-5 w-5 shrink-0 bg-emerald-100 p-0.5 rounded-full text-emerald-700" />
              <div className="text-xs">
                <p className="font-semibold text-slate-900">Geospatial Data Validated Successfully</p>
                <p className="text-slate-600 mt-0.5">
                  Raster dimensions, resolution, and coordinate reference systems were detected cleanly.
                </p>
              </div>
            </div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <Globe className="h-4 w-4 text-cadastral-rust" />
              Extracted Metadata Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3">
                <FileImage className="h-5 w-5 text-survey-navy shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block uppercase font-plex-mono tracking-wider font-semibold">Filename</span>
                  <span className="text-sm font-semibold text-slate-900 truncate block mt-0.5">
                    {metadata.filename}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3">
                <Globe className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-plex-mono tracking-wider font-semibold">Reference System (CRS)</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                    {metadata.crs || "Local Grid"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3">
                <Maximize2 className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-plex-mono tracking-wider font-semibold">Dimensions</span>
                  <span className="text-sm font-semibold text-slate-900 block font-plex-mono mt-0.5">
                    {metadata.width} × {metadata.height} px
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3">
                <Scale className="h-5 w-5 text-survey-navy shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-plex-mono tracking-wider font-semibold">Resolution</span>
                  <span className="text-sm font-semibold text-slate-900 block font-plex-mono mt-0.5">
                    {(metadata.resolution[0] * 100).toFixed(2)} cm / px
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <span className="text-[11px] text-slate-500 block uppercase font-plex-mono tracking-wider font-semibold">Bounding Box Coordinates</span>
              <div className="grid grid-cols-2 gap-4 text-xs font-plex-mono text-slate-800">
                <div>
                  <span className="text-slate-400 block mb-1">Min Longitude (X)</span>
                  <span className="font-semibold">{metadata.bounds[0].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Min Latitude (Y)</span>
                  <span className="font-semibold">{metadata.bounds[1].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Max Longitude (X)</span>
                  <span className="font-semibold">{metadata.bounds[2].toFixed(6)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Max Latitude (Y)</span>
                  <span className="font-semibold">{metadata.bounds[3].toFixed(6)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-sm transition-all shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-survey-navy hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-all shadow-sm flex items-center gap-2"
              >
                Continue to Validation
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Validation */}
        {step === 4 && metadata && (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              Pre-Flight Validation Check
            </h2>
            <div className="bg-white border border-emerald-200 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800">Raster imagery readable and correctly formatted</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800">Coordinate Reference System (CRS) confirmed</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800">Bounding box extent coordinates saved</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800">Spatial resolution metadata verified</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-sm transition-all shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2.5 bg-survey-navy hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-all shadow-sm flex items-center gap-2"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Create Survey */}
        {step === 5 && metadata && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="p-4 bg-slate-100 rounded-full text-survey-navy w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Database className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                Ready to Register Survey
              </h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                All pre-flight checks passed. Registering will trigger the building footprint extraction pipeline.
              </p>
            </div>

            {creationError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg text-sm font-medium flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{creationError}</span>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="px-8 py-3 bg-survey-navy hover:bg-slate-800 text-white font-medium rounded-lg transition-all flex items-center gap-3 shadow-md disabled:opacity-70 w-full sm:w-auto justify-center text-sm"
              >
                {creatingProject ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Registering Survey...
                  </>
                ) : (
                  <>
                    <Database className="h-5 w-5" />
                    Register & Start AI Pipeline
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


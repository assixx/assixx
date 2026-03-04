/** Shared types for ExecutionForm + DefectSection */

export interface StagedPhoto {
  file: File;
  previewUrl: string;
}

export interface DefectEntry {
  id: number;
  title: string;
  description: string;
  stagedPhotos: StagedPhoto[];
}

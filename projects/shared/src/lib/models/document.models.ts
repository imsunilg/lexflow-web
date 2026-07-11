/** PRD Module 7 — Document Management. */
export const DOCUMENT_TYPES = [
  'Pleading',
  'Order',
  'Agreement',
  'Evidence',
  'ID',
  'Invoice',
  'Other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const CONFIDENTIALITY_LEVELS = ['Normal', 'Confidential', 'Privileged'] as const;
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];

/**
 * OCR status isn't a confirmed closed enum server-side (kept as `string`
 * rather than a union) — seen values include at least `Pending`/`Processing`/
 * `Indexed`/`OcrFailed` per the PRD's pipeline description and Error Handling
 * section, but the backend doesn't publish an authoritative list.
 */
export type OcrStatus = string;

export const SIGNATURE_PROVIDERS = ['DocuSign', 'AdobeSign'] as const;
export type SignatureProvider = (typeof SIGNATURE_PROVIDERS)[number];

/**
 * `DocumentDto` as actually returned by the backend — confirmed to NOT
 * include tags, size, hash, or a thumbnail URL (those live only on
 * `DocumentVersion`, fetched separately via `listVersions`). `portalPublished`
 * is present but there is no confirmed mutating endpoint for it yet (no
 * "publish to portal" toggle exists server-side) — treat it as read-only.
 */
export interface LfDocument {
  id: string;
  title: string;
  docType: DocumentType;
  confidentiality: ConfidentialityLevel;
  folderId: string | null;
  matterId: string | null;
  clientId: string | null;
  caseId: string | null;
  currentVersionId: string | null;
  portalPublished: boolean;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  sizeBytes: number;
  mime: string | null;
  hashSha256: string;
  ocrStatus: OcrStatus;
  textExtracted: boolean;
  uploadedBy: string | null;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  matterId: string | null;
  path: string | null;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
  matterId?: string | null;
}

export interface UploadDocumentMetadata {
  folderId?: string | null;
  matterId?: string | null;
  clientId?: string | null;
  caseId?: string | null;
  title: string;
  docType: DocumentType;
  confidentiality: ConfidentialityLevel;
  tags?: string[];
}

export interface UpdateDocumentMetadataRequest {
  title: string;
  docType: DocumentType;
  confidentiality: ConfidentialityLevel;
  folderId?: string | null;
}

export type BulkDocumentAction = 'move' | 'tag' | 'delete' | 'download-zip';

export interface BulkDocumentActionRequest {
  action: BulkDocumentAction;
  ids: string[];
  targetFolderId?: string | null;
  tagNames?: string[];
}

export interface DocumentSearchHit {
  documentId: string;
  title: string;
  docType: DocumentType;
  confidentiality: ConfidentialityLevel;
  score: number;
  snippet: string | null;
}

export interface CreateShareLinkRequest {
  expiresAt: string;
  password?: string | null;
  maxDownloads?: number | null;
  watermark?: string | null;
}

export interface CreateShareLinkResult {
  id: string;
  token: string;
  expiresAt: string;
}

export interface MergeFieldInput {
  name: string;
  label: string;
  required: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string | null;
  version: number;
  fields: MergeFieldInput[];
}

export interface GenerateFromTemplateRequest {
  matterId: string;
  overrides: Record<string, string>;
}

export interface SendForSignatureRequest {
  provider: SignatureProvider;
  signers: { name: string; email: string; orderNo?: number }[];
}

export interface SignatureSigner {
  id: string;
  name: string;
  email: string;
  orderNo: number;
  status: string;
  signedAt: string | null;
}

export interface SignatureEnvelope {
  id: string;
  documentId: string;
  provider: SignatureProvider;
  providerEnvelopeId: string | null;
  status: string;
  completedDocVersionId: string | null;
  signers: SignatureSigner[];
}

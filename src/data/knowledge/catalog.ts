import manifestJson from "./manifest.json";
import accountDocument from "./documents/KB-ACCOUNT-009.json";
import benefitDocument from "./documents/KB-BENEFIT-003.json";
import benefitDisputeDocument from "./documents/KB-BENEFIT-004.json";
import oldBenefitDocument from "./documents/KB-BENEFIT-OLD-010.json";
import complaintDocument from "./documents/KB-COMPLAINT-006.json";
import memberRenewalDocument from "./documents/KB-MEMBER-001.json";
import memberStatusDocument from "./documents/KB-MEMBER-002.json";
import operationDocument from "./documents/KB-OPERATION-005.json";
import refundDocument from "./documents/KB-REFUND-007.json";
import securityDocument from "./documents/KB-SECURITY-008.json";
import accountChunks from "./chunks/KB-ACCOUNT-009.json";
import benefitChunks from "./chunks/KB-BENEFIT-003.json";
import benefitDisputeChunks from "./chunks/KB-BENEFIT-004.json";
import oldBenefitChunks from "./chunks/KB-BENEFIT-OLD-010.json";
import complaintChunks from "./chunks/KB-COMPLAINT-006.json";
import memberRenewalChunks from "./chunks/KB-MEMBER-001.json";
import memberStatusChunks from "./chunks/KB-MEMBER-002.json";
import operationChunks from "./chunks/KB-OPERATION-005.json";
import refundChunks from "./chunks/KB-REFUND-007.json";
import securityChunks from "./chunks/KB-SECURITY-008.json";
import type { KnowledgeCatalog, KnowledgeChunk, KnowledgeDocument, KnowledgeManifest } from "@/rag/types";

export const knowledgeCatalog: KnowledgeCatalog = {
  manifest: manifestJson as KnowledgeManifest,
  documents: [
    accountDocument,
    benefitDocument,
    benefitDisputeDocument,
    oldBenefitDocument,
    complaintDocument,
    memberRenewalDocument,
    memberStatusDocument,
    operationDocument,
    refundDocument,
    securityDocument,
  ] as KnowledgeDocument[],
  chunks: [
    ...accountChunks,
    ...benefitChunks,
    ...benefitDisputeChunks,
    ...oldBenefitChunks,
    ...complaintChunks,
    ...memberRenewalChunks,
    ...memberStatusChunks,
    ...operationChunks,
    ...refundChunks,
    ...securityChunks,
  ] as KnowledgeChunk[],
};

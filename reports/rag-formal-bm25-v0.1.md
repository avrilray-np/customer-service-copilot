# 正式RAG评估集 BM25结果 v0.1

- 案例：30条，其中有必需依据的案例28条。
- Recall@3：0.8750
- MRR：0.9048
- Precision@3：0.4444
- EvidenceGate可回答性准确率：1.0000
- 检索延迟P50/P95：0.10 / 0.15 ms
- 本报告不包含生成回答、引用正确性或人工Answer Correctness评分。

## 未完全召回案例

- RAG-011：Recall@3=0.50；Top-3=KB-BENEFIT-003#ineligible-no-auto-reissue, KB-BENEFIT-003#eligible-products-current, KB-MEMBER-001#cancel-next-charge
- RAG-013：Recall@3=0.00；Top-3=KB-BENEFIT-004#compensation-missing-information, KB-BENEFIT-003#ineligible-no-auto-reissue, KB-BENEFIT-004#qualification-dispute-review
- RAG-018：Recall@3=0.50；Top-3=KB-ACCOUNT-009#profile-change, KB-MEMBER-001#unsubscribe-human-action, KB-ACCOUNT-009#personal-data-boundary
- RAG-020：Recall@3=0.50；Top-3=KB-OPERATION-005#ai-no-completion-claim, KB-OPERATION-005#status-query-readonly, KB-BENEFIT-003#ineligible-no-auto-reissue
- RAG-022：Recall@3=0.50；Top-3=KB-MEMBER-001#cancel-next-charge, KB-MEMBER-001#cancel-current-entitlement, KB-REFUND-007#post-cancellation-charge
- RAG-023：Recall@3=0.50；Top-3=KB-REFUND-007#refund-identity, KB-OPERATION-005#ambiguous-request, KB-MEMBER-001#cancel-not-refund

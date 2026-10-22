# BM25检索基线 v0.1

- 案例数：12
- Recall@3：0.9583
- MRR：0.9583
- 说明：本报告只评估本地BM25，不包含Embedding、RRF或生成回答质量。

| 案例 | Recall@3 | Reciprocal Rank | Top-3片段 |
|---|---:|---:|---|
| BM25-001 | 1.00 | 0.50 | KB-BENEFIT-003#eligible-products-current<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-MEMBER-001#unsubscribe-human-action |
| BM25-002 | 1.00 | 1.00 | KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#cancel-not-refund<br>KB-REFUND-007#post-cancellation-charge |
| BM25-003 | 1.00 | 1.00 | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-REFUND-007#refund-with-reissue |
| BM25-004 | 1.00 | 1.00 | KB-BENEFIT-003#coupon-status-data<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-OPERATION-005#write-action-tier1 |
| BM25-005 | 1.00 | 1.00 | KB-BENEFIT-004#qualification-dispute-review<br>KB-BENEFIT-004#compensation-missing-information<br>KB-COMPLAINT-006#complaint-registration |
| BM25-006 | 1.00 | 1.00 | KB-REFUND-007#refund-tier2<br>KB-REFUND-007#refund-identity<br>KB-BENEFIT-003#eligible-products-current |
| BM25-007 | 1.00 | 1.00 | KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-MEMBER-001#cancel-next-charge |
| BM25-008 | 1.00 | 1.00 | KB-SECURITY-008#account-security<br>KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#cancel-not-refund |
| BM25-009 | 1.00 | 1.00 | KB-ACCOUNT-009#profile-change<br>KB-ACCOUNT-009#personal-data-boundary<br>KB-OPERATION-005#write-action-tier1 |
| BM25-010 | 1.00 | 1.00 | KB-MEMBER-002#membership-expiry-query<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-MEMBER-002#general-benefit-query |
| BM25-011 | 0.50 | 1.00 | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-MEMBER-001#cancel-not-refund |
| BM25-012 | 1.00 | 1.00 | KB-OPERATION-005#ambiguous-request<br>KB-MEMBER-001#unsubscribe-human-action<br>KB-OPERATION-005#status-query-readonly |

# RAG检索模式对比 v0.1

- 知识库版本：kb-2026.10-rag-v0.1
- Embedding：siliconflow / BAAI/bge-m3
- 固定评估问题：12条；所有模式使用同一知识库、同一问题和Top-3口径。
- Vector与Hybrid均为真实运行结果；本报告未启用BM25降级。
- 耗时为本次本地运行观测值，仅用于相对比较，不代表线上SLA。

| 模式 | Recall@3 | MRR | 平均总耗时(ms) |
|---|---:|---:|---:|
| bm25 | 0.9583 | 0.9583 | 0.49 |
| vector | 0.9167 | 0.8750 | 22.60 |
| hybrid | 1.0000 | 0.9167 | 22.79 |

| 案例 | BM25 Top-3 | Vector Top-3 | Hybrid Top-3 |
|---|---|---|---|
| BM25-001 | KB-BENEFIT-003#eligible-products-current<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-MEMBER-001#unsubscribe-human-action | KB-MEMBER-001#unsubscribe-human-action<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-MEMBER-002#membership-status-identity | KB-MEMBER-001#unsubscribe-human-action<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-BENEFIT-003#eligible-products-current |
| BM25-002 | KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#cancel-not-refund<br>KB-REFUND-007#post-cancellation-charge | KB-MEMBER-001#cancel-next-charge<br>KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-current-entitlement | KB-MEMBER-001#cancel-next-charge<br>KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-current-entitlement |
| BM25-003 | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-REFUND-007#refund-with-reissue | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-MEMBER-002#general-benefit-query | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-REFUND-007#refund-with-reissue |
| BM25-004 | KB-BENEFIT-003#coupon-status-data<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-OPERATION-005#write-action-tier1 | KB-BENEFIT-003#coupon-delivery-window<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-MEMBER-002#membership-status-identity | KB-BENEFIT-003#coupon-delivery-window<br>KB-BENEFIT-003#coupon-status-data<br>KB-OPERATION-005#write-action-tier1 |
| BM25-005 | KB-BENEFIT-004#qualification-dispute-review<br>KB-BENEFIT-004#compensation-missing-information<br>KB-COMPLAINT-006#complaint-registration | KB-BENEFIT-004#qualification-dispute-review<br>KB-BENEFIT-004#compensation-missing-information<br>KB-BENEFIT-003#ineligible-no-auto-reissue | KB-BENEFIT-004#qualification-dispute-review<br>KB-BENEFIT-004#compensation-missing-information<br>KB-BENEFIT-003#ineligible-no-auto-reissue |
| BM25-006 | KB-REFUND-007#refund-tier2<br>KB-REFUND-007#refund-identity<br>KB-BENEFIT-003#eligible-products-current | KB-REFUND-007#refund-tier2<br>KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-next-charge | KB-REFUND-007#refund-tier2<br>KB-REFUND-007#refund-identity<br>KB-MEMBER-001#cancel-next-charge |
| BM25-007 | KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-MEMBER-001#cancel-next-charge | KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#unsubscribe-human-action | KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#cancel-current-entitlement |
| BM25-008 | KB-SECURITY-008#account-security<br>KB-MEMBER-001#cancel-next-charge<br>KB-MEMBER-001#cancel-not-refund | KB-SECURITY-008#account-security<br>KB-REFUND-007#post-cancellation-charge<br>KB-ACCOUNT-009#profile-change | KB-SECURITY-008#account-security<br>KB-REFUND-007#post-cancellation-charge<br>KB-MEMBER-001#cancel-next-charge |
| BM25-009 | KB-ACCOUNT-009#profile-change<br>KB-ACCOUNT-009#personal-data-boundary<br>KB-OPERATION-005#write-action-tier1 | KB-ACCOUNT-009#profile-change<br>KB-ACCOUNT-009#unverified-profile<br>KB-MEMBER-002#membership-status-identity | KB-ACCOUNT-009#profile-change<br>KB-ACCOUNT-009#unverified-profile<br>KB-OPERATION-005#write-action-tier1 |
| BM25-010 | KB-MEMBER-002#membership-expiry-query<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-MEMBER-002#general-benefit-query | KB-MEMBER-002#membership-expiry-query<br>KB-MEMBER-001#cancel-current-entitlement<br>KB-BENEFIT-003#coupon-delivery-window | KB-MEMBER-002#membership-expiry-query<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-MEMBER-001#cancel-current-entitlement |
| BM25-011 | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#ineligible-no-auto-reissue<br>KB-MEMBER-001#cancel-not-refund | KB-BENEFIT-003#coupon-delivery-window<br>KB-BENEFIT-003#eligible-products-current<br>KB-MEMBER-002#membership-expiry-query | KB-BENEFIT-003#eligible-products-current<br>KB-BENEFIT-003#coupon-delivery-window<br>KB-MEMBER-002#membership-expiry-query |
| BM25-012 | KB-OPERATION-005#ambiguous-request<br>KB-MEMBER-001#unsubscribe-human-action<br>KB-OPERATION-005#status-query-readonly | KB-OPERATION-005#ambiguous-request<br>KB-MEMBER-001#unsubscribe-human-action<br>KB-MEMBER-001#cancel-next-charge | KB-OPERATION-005#ambiguous-request<br>KB-MEMBER-001#unsubscribe-human-action<br>KB-MEMBER-001#cancel-next-charge |

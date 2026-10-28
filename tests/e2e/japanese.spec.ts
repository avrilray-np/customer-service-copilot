import { expect, test } from "@playwright/test";

test("Japanese route keeps the English controls and completes the AI-only journey", async ({ page }) => {
  await page.goto("/jp");

  await expect(page).toHaveTitle("カスタマーサポート Copilot");
  await expect(page.getByRole("heading", { name: "AIカスタマーサポートとチケット処理フロー" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI Only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Low-Risk AI Assist & Handoff" })).toBeVisible();
  await expect(page.getByRole("button", { name: "High-Risk AI Fast-Track" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mock Mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI Mode" })).toBeVisible();
  await expect(page.getByText("我昨天已经取消连续包月了，为什么今天还是会员？之后还会扣钱吗？").first()).toBeVisible();

  await page.getByRole("button", { name: "解決済み" }).click();
  await expect(page.getByLabel("チケット一覧画面")).toBeVisible();
  await page.getByRole("button", { name: "チケット詳細を表示" }).click();
  await expect(page.getByLabel("AI生成のお問い合わせ要約")).toContainText("用户已取消自动续订");
  await expect(page.getByLabel("元音声・文字起こし")).toContainText("我昨天已经取消连续包月了");
  await page.getByText("検索トレースを表示").click();
  await expect(page.getByLabel("検索トレース")).toContainText("要求／実行モード");
});

test("Japanese route completes the low-risk assisted journey", async ({ page }) => {
  await page.goto("/jp");
  await page.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }).click();
  await page.getByRole("button", { name: /追加依頼：クーポン再発行・苦情申告/ }).click();

  await expect(page.getByText("帮我补发优惠券，我还要投诉活动规则不清楚。")).toBeVisible();
  await expect(page.getByLabel("チケット一覧画面")).toBeVisible();
  await page.getByRole("button", { name: "チケット詳細を表示" }).click();
  await expect(page.getByLabel("一次対応操作")).toContainText("元のキャンペーン対象条件：対象外");
  await page.getByRole("button", { name: "クーポンを再発行" }).click();
  await page.getByRole("button", { name: "キャンペーン企画部へ通知" }).click();
  await page.getByRole("button", { name: "対応完了・アーカイブ" }).click();
  await expect(page.getByTestId("ticket-status")).toContainText("完了");
});

test("Japanese route completes the high-risk tier-two journey", async ({ page }) => {
  await page.goto("/jp");
  await page.getByRole("button", { name: "High-Risk AI Fast-Track" }).click();

  await expect(page.getByLabel("チケット一覧画面")).toBeVisible();
  await page.getByRole("button", { name: "チケット詳細を表示" }).click();
  await expect(page.getByLabel("二次対応操作")).toContainText("高リスク：返金＋通報");
  await page.getByRole("button", { name: "30元を返金" }).click();
  await page.getByRole("button", { name: "通報依頼を登録" }).click();
  await page.getByRole("button", { name: "二次対応を完了・アーカイブ" }).click();
  await expect(page.getByTestId("ticket-status")).toContainText("完了");
});

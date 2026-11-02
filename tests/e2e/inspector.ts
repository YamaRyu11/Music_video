import { type Page } from '@playwright/test';
export async function openInspector(page: Page, name: string) {
  if (name === 'テキスト') return page.getByRole('button', { name: 'タイトルを編集', exact: true }).click();
  if (name === '背景ビットマップ') return page.getByRole('button', { name: '背景ビットマップを編集', exact: true }).click();
  if (await page.getByRole('region', { name: 'カラー・動きの設定', exact: true }).isVisible()) return;
  const hint = await page.locator('.style-drag-hint').textContent();
  return page.getByRole('button', { name: `レイヤー${hint?.trim().startsWith('レイヤー02') ? '02' : '01'}を編集`, exact: true }).click();
}

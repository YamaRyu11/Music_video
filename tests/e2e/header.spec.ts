import { test, expect } from '@playwright/test';
import { openInspector } from './inspector';

for (const viewport of [{ width: 900, height: 640 }, { width: 1440, height: 900 }]) {
  test(`cards drive one inspector without tabs at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await expect(page.getByRole('tab')).toHaveCount(0);
    const bg = page.getByLabel('背景色', { exact: true });
    await expect(bg).toHaveCount(1);
    const bgBox = (await bg.boundingBox())!, bitmapBox = (await page.getByRole('button', { name: '背景ビットマップを編集' }).boundingBox())!;
    expect(bgBox.x).toBeLessThan(bitmapBox.x);
    await bg.fill('#253647');
    for (const aspect of ['横 16:9', '縦 9:16']) {
      await page.getByRole('button', { name: aspect, exact: true }).click();
      await openInspector(page, '背景ビットマップ');
      await expect(page.getByRole('button', { name: '背景ビットマップを編集' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('region', { name: '背景ビットマップの設定', exact: true })).toBeVisible();
      for (const number of ['01', '02']) {
        await page.getByRole('button', { name: `レイヤー${number}を編集`, exact: true }).click();
        await expect(page.getByRole('region', { name: 'カラー・動きの設定', exact: true })).toBeVisible();
        await expect(page.getByRole('combobox', { name: '合成方法', exact: true })).toHaveCount(1);
        await expect(page.getByRole('banner').getByRole('combobox', { name: '合成方法' })).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'タイトルを編集', exact: true }).click();
      await expect(page.getByRole('region', { name: 'テキストの設定', exact: true })).toBeVisible();
      await expect(bg).toHaveValue('#253647');
      await expect(page.locator('.export-button')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => { const e = document.scrollingElement!; return [e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]; })).toEqual([0,0]);
      const c = (await page.locator('canvas').boundingBox())!;
      expect(c.width/c.height).toBeCloseTo(aspect.startsWith('縦') ? 9/16 : 16/9,2);
    }
  });
}

test('base and overlay blend and opacity are independent and base can expose the bitmap', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('背景色', { exact: true }).fill('#45789a');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0.35');
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('multiply');
  await page.getByRole('button', { name: 'レイヤー02を編集', exact: true }).click();
  await page.getByRole('combobox', { name: '重ねるスタイル', exact: true }).selectOption('wave');
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0.8');
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('lighter');
  await page.getByRole('button', { name: 'レイヤー01を編集', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true })).toHaveValue('0.35');
  await expect(page.getByRole('combobox', { name: '合成方法', exact: true })).toHaveValue('multiply');
  const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width=160;c.height=90; const x=c.getContext('2d')!;x.fillStyle='#c94727';x.fillRect(0,0,160,90);return c.toDataURL().split(',')[1]; });
  await page.getByLabel('背景画像ファイル', { exact: true }).setInputFiles({name:'red.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button', { name: 'レイヤー02を編集', exact: true }).click();
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0');
  await page.getByRole('button', { name: 'レイヤー01を編集', exact: true }).click();
  const pixels = async () => { await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));return page.locator('canvas').evaluate(c=>(c as HTMLCanvasElement).toDataURL()); };
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('0');
  const plain = await pixels();
  const corner = await page.locator('canvas').evaluate(c=>Array.from((c as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,1,1).data));
  expect(corner).toEqual([201,71,39,255]);
  await page.getByRole('slider', { name: 'レイヤーの不透明度', exact: true }).fill('1');
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('source-over'); const normal=await pixels(); expect(normal).not.toBe(plain);
  await page.getByRole('combobox', { name: '合成方法', exact: true }).selectOption('screen'); expect(await pixels()).not.toBe(normal);
});

test('clicking visible preview text selects its inspector at either aspect', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'タイトルを編集', exact: true }).click();
  await page.getByPlaceholder('曲名を入力（任意）').fill('CLICK TITLE');
  await page.getByPlaceholder('アーティスト名を入力（任意）').fill('CLICK ARTIST');
  for (const aspect of ['横 16:9','縦 9:16']) {
    await page.getByRole('button', { name: aspect, exact: true }).click();
    for (const [target,y] of [['タイトル',.79],['アーティスト',.835]] as const) {
      await page.getByRole('button', { name: 'レイヤー01を編集', exact: true }).click();
      const box=(await page.locator('canvas').boundingBox())!;
      await page.mouse.click(box.x+box.width*.5,box.y+box.height*y);
      await expect(page.getByRole('region', { name:'テキストの設定',exact:true })).toBeVisible();
      await expect(page.getByRole('button', { name:`${target}を編集`,exact:true })).toHaveAttribute('aria-pressed','true');
    }
  }
});

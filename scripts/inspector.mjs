export async function openInspector(page, name) {
  if (name === 'テキスト') return page.getByRole('button', { name: 'タイトルを編集', exact: true }).click();
  if (name === '背景ビットマップ') return page.getByRole('button', { name: '背景ビットマップを編集', exact: true }).click();
  if (await page.getByRole('region', { name: 'カラー・動きの設定', exact: true }).isVisible()) return;
  const hint = await page.locator('.style-drag-hint').textContent();
  return page.getByRole('button', { name: `レイヤー${hint?.trim().startsWith('レイヤー02') ? '02' : '01'}を編集`, exact: true }).click();
}

export async function expandLayerControls(page) {
  for (const number of ['01','02']) {
    await page.getByRole('button',{name:`レイヤー${number}を編集`,exact:true}).click();
    for (const title of ['カラー設定','エフェクト']) {
      const section=page.locator('details').filter({has:page.locator('summary').filter({hasText:title})});
      if(await section.getAttribute('open')===null)await section.locator('summary').click();
    }
  }
  await page.getByRole('button',{name:'レイヤー01を編集',exact:true}).click();
}

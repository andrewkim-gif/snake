/**
 * Globe diagnostic script — Playwright로 순수 Three.js 지구본 검증
 * Usage: node scripts/globe-diag.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:9001';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const logs = [];
  const errors = [];

  page.on('console', msg => { logs.push(`[${msg.type()}] ${msg.text()}`); });
  page.on('pageerror', err => { errors.push(err.message); });
  page.on('requestfailed', req => { errors.push(`LOAD FAILED: ${req.url()} — ${req.failure()?.errorText}`); });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // BRIEFING 모달 닫기
  const skipBtn = page.locator('button:has-text("SKIP")');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // 렌더링 대기
  console.log('Waiting 8s for globe rendering...');
  await page.waitForTimeout(8000);

  // R3F 씬 분석 (SceneExposer가 window.__scene에 노출)
  const sceneInfo = await page.evaluate(() => {
    const scene = window.__scene;
    if (!scene) return { error: 'no __scene (SceneExposer not mounted yet)' };

    let meshCount = 0, groupCount = 0, lineCount = 0, spriteCount = 0;
    const materials = [];
    const countryMeshes = [];

    scene.traverse(obj => {
      if (obj.type === 'Mesh') {
        meshCount++;
        // 국가 폴리곤 (userData.iso3 존재)
        if (obj.userData?.iso3 && countryMeshes.length < 5) {
          countryMeshes.push({
            iso3: obj.userData.iso3,
            name: obj.userData.name,
            color: obj.material?.color ? '#' + obj.material.color.getHexString() : null,
            visible: obj.visible,
            vertexCount: obj.geometry?.attributes?.position?.count || 0,
          });
        }
        // 첫 5개 메시 머티리얼
        if (materials.length < 5) {
          const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
          materials.push({
            type: mat?.type,
            color: mat?.color ? '#' + mat.color.getHexString() : null,
            side: mat?.side,
            transparent: mat?.transparent,
            opacity: mat?.opacity,
          });
        }
      }
      if (obj.type === 'Group') groupCount++;
      if (obj.type === 'LineSegments') lineCount++;
      if (obj.type === 'Sprite') spriteCount++;
    });

    // 라벨 그룹 찾기
    let labelGroup = null;
    scene.traverse(c => {
      if (c.name === 'country-labels') {
        labelGroup = {
          childCount: c.children.length,
          visible: c.visible,
          firstSpriteOpacity: c.children[0]?.material?.opacity,
          firstSpriteVisible: c.children[0]?.visible,
        };
      }
    });

    // 카메라 정보
    const cam = window.__camera;

    return {
      meshCount, groupCount, lineCount, spriteCount,
      sceneChildren: scene.children.length,
      camera: cam ? { pos: cam.position.toArray().map(v => Math.round(v)), fov: cam.fov } : null,
      materials,
      countryMeshes,
      labelGroup,
      rendererInfo: { width: document.querySelector('canvas')?.width, height: document.querySelector('canvas')?.height },
    };
  });

  console.log('\n=== SCENE INFO ===');
  console.log(JSON.stringify(sceneInfo, null, 2));

  // 클릭 테스트
  console.log('\nClicking on globe center...');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1000);

  // 스크린샷
  await page.screenshot({ path: '/tmp/globe-diag.png', fullPage: false });
  console.log('Screenshot saved to /tmp/globe-diag.png');

  console.log('\n=== CONSOLE LOGS ===');
  for (const log of logs) console.log(log);

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) console.log('(No errors)');
  else for (const err of errors) console.log('ERROR:', err);

  console.log(`\nTotal: ${logs.length} logs, ${errors.length} errors`);
  await browser.close();
}

run().catch(console.error);

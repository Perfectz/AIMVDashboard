const { test, expect } = require('@playwright/test');

const ROUTES = [
  { path: '/', heading: 'Project Home' },
  { path: '/step1.html', heading: 'Step 1: Project Theme & Concept' },
  { path: '/step2.html', heading: 'Step 2: Upload Music & Analysis' },
  { path: '/step3.html', heading: 'Step 3: Content Blueprint' },
  { path: '/step4.html', heading: 'Step 4: References & Assets' },
  { path: '/guide.html', heading: 'AI Music Video - Complete User Guide' },
  { path: '/index.html', heading: 'Shot Review' },
  { path: '/storyboard.html', heading: 'Storyboard Builder' }
];

async function assertLeftNavLoaded(page) {
  await expect(page.locator('nav.left-nav')).toBeVisible();
  await expect(page.locator('[data-ui-project-selector]')).toBeVisible();
  await page.waitForFunction(() => {
    const links = document.querySelectorAll('[data-ui-workflow-nav] a, [data-ui-workflow-nav] button');
    return links.length >= 4;
  });
}

test.describe('UI smoke', () => {
  test('core pages load with consistent left navigation', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path);
      await assertLeftNavLoaded(page);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    }
  });

  test('storyboard critical controls render', async ({ page }) => {
    await page.goto('/storyboard.html');
    await assertLeftNavLoaded(page);
    await expect(page.locator('#musicStatusPill')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grid View' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filmstrip' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Timeline' })).toBeVisible();
    await expect(page.locator('#assetPanel')).toBeVisible();
  });

  test('no uncaught runtime errors on core routes', async ({ page }) => {
    const runtimeErrors = [];
    page.on('pageerror', (err) => runtimeErrors.push(err.message));

    for (const route of ROUTES) {
      await page.goto(route.path);
      await assertLeftNavLoaded(page);
      await page.waitForTimeout(150);
    }

    expect(runtimeErrors).toEqual([]);
  });
});

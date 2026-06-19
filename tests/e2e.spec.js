// @ts-check
const { test, expect } = require('@playwright/test');

async function waitForBoot(page) {
    await page.waitForFunction(
        () => {
            const s = document.getElementById('statusText');
            return s && !s.textContent.startsWith('Đang tải');
        },
        { timeout: 12000 }
    );
}

test.describe('WC2026 data loading', () => {

    test('loads match data (online or offline fallback)', async ({ page }) => {
        await page.goto('/');
        await waitForBoot(page);
        const badgeText = await page.locator('#matchCountBadge').textContent();
        console.log('Badge:', badgeText);
        expect(parseInt(badgeText)).toBeGreaterThan(0);
    });

    test('app section visible for anon users', async ({ page }) => {
        await page.goto('/');
        await waitForBoot(page);
        await expect(page.locator('#appSection')).not.toHaveClass(/hidden/);
    });

    test('status banner shows no error', async ({ page }) => {
        await page.goto('/');
        await waitForBoot(page);
        const text = await page.locator('#statusText').textContent();
        expect(text).not.toContain('❌');
    });

    test('offline fallback: block openfootball, still shows data from local JSON', async ({ page }) => {
        await page.route('**/raw.githubusercontent.com/**', route => route.abort());
        await page.goto('/');
        await waitForBoot(page);
        const badgeText = await page.locator('#matchCountBadge').textContent();
        const status = await page.locator('#statusText').textContent();
        console.log('[offline] Badge:', badgeText, '| Status:', status);
        expect(parseInt(badgeText)).toBeGreaterThan(0);
        expect(status).not.toContain('❌');
    });

    test('match-details state populated from local JSON', async ({ page }) => {
        await page.goto('/');
        await waitForBoot(page);
        await page.waitForFunction(
            () => typeof state !== 'undefined' && Object.keys(state.matchDetails || {}).length > 0,
            { timeout: 8000 }
        );
        const count = await page.evaluate(() => Object.keys(state.matchDetails || {}).length);
        console.log('matchDetails count:', count);
        expect(count).toBeGreaterThan(0);
    });

});

test.describe('Tab Trận đấu - panel nâng cao', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await waitForBoot(page);
        await page.waitForFunction(
            () => typeof state !== 'undefined' && Object.keys(state.matchDetails || {}).length > 0,
            { timeout: 8000 }
        );
        // Navigate to Trận đấu tab
        await page.locator('.tab-btn[data-target="tab-matches"]').click();
        await page.waitForTimeout(200);
        // Switch to past sub-tab
        await page.locator('#matchesTabPast').click();
        await page.waitForTimeout(200);
    });

    test('click row mở panel nâng cao', async ({ page }) => {
        const firstRow = page.locator('#matchesListContainer .match-row').first();
        const panel = firstRow.locator('.match-adv-panel');

        // Panel phải ẩn ban đầu
        await expect(panel).toHaveClass(/hidden/);

        // Click vào row → mở panel
        await firstRow.click({ position: { x: 50, y: 15 } });
        await expect(panel).not.toHaveClass(/hidden/);
    });

    test('click vào details bên trong panel không đóng panel', async ({ page }) => {
        const firstRow = page.locator('#matchesListContainer .match-row').first();
        const panel = firstRow.locator('.match-adv-panel');

        // Mở panel
        await firstRow.click({ position: { x: 50, y: 15 } });
        await expect(panel).not.toHaveClass(/hidden/);

        // Click vào summary bên trong (details con) → panel phải VẪN mở
        const innerSummary = panel.locator('details summary').first();
        if (await innerSummary.count() > 0) {
            await innerSummary.click();
            await page.waitForTimeout(100);
            // Panel phải vẫn visible
            await expect(panel).not.toHaveClass(/hidden/);
            console.log('✓ Click inner summary không đóng panel ngoài');
        } else {
            console.log('(không có inner details — bỏ qua)');
        }
    });

    test('click lại row đóng panel', async ({ page }) => {
        const firstRow = page.locator('#matchesListContainer .match-row').first();
        const panel = firstRow.locator('.match-adv-panel');

        // Mở
        await firstRow.click({ position: { x: 50, y: 15 } });
        await expect(panel).not.toHaveClass(/hidden/);

        // Click lại → đóng
        await firstRow.click({ position: { x: 50, y: 15 } });
        await expect(panel).toHaveClass(/hidden/);
    });

});

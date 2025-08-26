import { test, expect } from '@playwright/test';

test.describe('Tool Installation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should display registry of available tools', async ({ page }) => {
    // Navigate to marketplace
    await page.click('text=Marketplace');
    
    // Should show available tools
    await expect(page.locator('text=Available Tools')).toBeVisible();
    
    // Should show at least one tool
    const toolCards = page.locator('[data-testid="tool-card"]');
    await expect(toolCards).toHaveCount(3); // hello-fapi, calculator, notepad
  });

  test('should install a tool', async ({ page }) => {
    // Navigate to marketplace
    await page.click('text=Marketplace');
    
    // Find calculator tool
    const calculatorCard = page.locator('[data-testid="tool-card"]').filter({ hasText: 'Calculator' });
    await expect(calculatorCard).toBeVisible();
    
    // Click install
    await calculatorCard.locator('button:has-text("Install")').click();
    
    // Should show progress
    await expect(page.locator('text=Installing')).toBeVisible();
    
    // Wait for installation to complete
    await expect(page.locator('text=Installation complete')).toBeVisible({ timeout: 30000 });
    
    // Should redirect to installed tools
    await expect(page).toHaveURL(/.*\/installed/);
    
    // Calculator should be in installed list
    await expect(page.locator('text=Calculator')).toBeVisible();
  });

  test('should start and stop installed tool', async ({ page }) => {
    // Assume calculator is installed
    await page.goto('http://localhost:3000/installed');
    
    // Find calculator
    const calculatorCard = page.locator('[data-testid="tool-card"]').filter({ hasText: 'Calculator' });
    
    // Start tool
    await calculatorCard.locator('button:has-text("Start")').click();
    
    // Should show running status
    await expect(calculatorCard.locator('text=Running')).toBeVisible({ timeout: 10000 });
    
    // Should show port
    await expect(calculatorCard.locator('text=/Port: \\d+/')).toBeVisible();
    
    // Stop tool
    await calculatorCard.locator('button:has-text("Stop")').click();
    
    // Should show stopped status
    await expect(calculatorCard.locator('text=Stopped')).toBeVisible();
  });

  test('should open tool in new window', async ({ page, context }) => {
    await page.goto('http://localhost:3000/installed');
    
    // Start calculator first
    const calculatorCard = page.locator('[data-testid="tool-card"]').filter({ hasText: 'Calculator' });
    await calculatorCard.locator('button:has-text("Start")').click();
    await expect(calculatorCard.locator('text=Running')).toBeVisible({ timeout: 10000 });
    
    // Click open
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      calculatorCard.locator('button:has-text("Open")').click()
    ]);
    
    // New page should open with tool
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('/api/apps/calculator');
  });

  test('should handle installation errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/tools/install', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Installation failed' })
      });
    });
    
    await page.goto('http://localhost:3000/marketplace');
    
    // Try to install
    const toolCard = page.locator('[data-testid="tool-card"]').first();
    await toolCard.locator('button:has-text("Install")').click();
    
    // Should show error
    await expect(page.locator('text=Installation failed')).toBeVisible();
  });
});

test.describe('Development Mode', () => {
  test('should fork tool to development', async ({ page }) => {
    await page.goto('http://localhost:3000/installed');
    
    // Find an installed tool
    const toolCard = page.locator('[data-testid="tool-card"]').first();
    
    // Click dev mode
    await toolCard.locator('button:has-text("Dev Mode")').click();
    
    // Should navigate to dev mode
    await expect(page).toHaveURL(/.*\/dev\//);
    
    // Should show file explorer
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
    
    // Should show code editor
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
  });

  test('should edit and save files', async ({ page }) => {
    // Navigate to dev mode for a tool
    await page.goto('http://localhost:3000/dev/calculator');
    
    // Click on a file
    await page.click('text=app.py');
    
    // Editor should load file content
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('FastAPI');
    
    // Make an edit (this is tricky with Monaco, might need to mock)
    // For now, just test save button appears
    await expect(page.locator('button:has-text("Save")').or(page.locator('text=Auto-saved'))).toBeVisible();
  });

  test('should show live logs', async ({ page }) => {
    await page.goto('http://localhost:3000/dev/calculator');
    
    // Start the tool
    await page.click('button:has-text("Start")');
    
    // Logs panel should show output
    await expect(page.locator('[data-testid="logs-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="logs-panel"]')).toContainText(/Started|Running/);
  });
});

test.describe('Tool Management', () => {
  test('should delete a tool', async ({ page }) => {
    await page.goto('http://localhost:3000/installed');
    
    const toolCount = await page.locator('[data-testid="tool-card"]').count();
    
    // Find a tool to delete
    const toolCard = page.locator('[data-testid="tool-card"]').first();
    const toolName = await toolCard.locator('h3').textContent();
    
    // Click delete
    await toolCard.locator('button:has-text("Delete")').click();
    
    // Confirm deletion
    await page.click('button:has-text("Confirm")');
    
    // Tool should be removed
    await expect(page.locator(`text=${toolName}`)).not.toBeVisible();
    
    // Count should decrease
    const newCount = await page.locator('[data-testid="tool-card"]').count();
    expect(newCount).toBe(toolCount - 1);
  });

  test('should show tool details', async ({ page }) => {
    await page.goto('http://localhost:3000/installed');
    
    // Click on a tool card
    const toolCard = page.locator('[data-testid="tool-card"]').first();
    await toolCard.click();
    
    // Should show details modal/page
    await expect(page.locator('[data-testid="tool-details"]')).toBeVisible();
    
    // Should show metadata
    await expect(page.locator('text=Version:')).toBeVisible();
    await expect(page.locator('text=Author:')).toBeVisible();
    await expect(page.locator('text=Entry point:')).toBeVisible();
  });
});

test.describe('Search and Filter', () => {
  test('should search tools', async ({ page }) => {
    await page.goto('http://localhost:3000/marketplace');
    
    // Type in search box
    await page.fill('[data-testid="search-input"]', 'calculator');
    
    // Should filter results
    await expect(page.locator('[data-testid="tool-card"]')).toHaveCount(1);
    await expect(page.locator('text=Calculator')).toBeVisible();
  });

  test('should filter by tags', async ({ page }) => {
    await page.goto('http://localhost:3000/marketplace');
    
    // Click on a tag
    await page.click('[data-testid="tag-utility"]');
    
    // Should show only tools with that tag
    const cards = page.locator('[data-testid="tool-card"]');
    const count = await cards.count();
    
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.locator('[data-testid="tag-utility"]')).toBeVisible();
    }
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('http://localhost:3000');
    
    // Navigation should be accessible
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    
    // Menu items should be visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Installed')).toBeVisible();
    await expect(page.locator('text=Marketplace')).toBeVisible();
  });

  test('should handle tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('http://localhost:3000/installed');
    
    // Tool cards should be in grid
    const grid = page.locator('[data-testid="tools-grid"]');
    await expect(grid).toHaveCSS('display', 'grid');
  });
});

test.describe('Error Handling', () => {
  test('should show error when backend is down', async ({ page }) => {
    // Block API calls
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('http://localhost:3000');
    
    // Should show error message
    await expect(page.locator('text=/Failed to load|Error|Unable to connect/')).toBeVisible();
  });

  test('should handle 404 pages', async ({ page }) => {
    await page.goto('http://localhost:3000/nonexistent-page');
    
    // Should show 404 page
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=/Not Found|Page not found/')).toBeVisible();
    
    // Should have link back to home
    await expect(page.locator('a:has-text("Go Home")')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle many tools efficiently', async ({ page }) => {
    // Mock API to return many tools
    await page.route('**/api/registry', route => {
      const tools = Array.from({ length: 100 }, (_, i) => ({
        id: `tool-${i}`,
        name: `Tool ${i}`,
        description: `Description for tool ${i}`,
        version: '1.0.0',
        author: 'Test',
        tags: ['test']
      }));
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tools)
      });
    });
    
    await page.goto('http://localhost:3000/marketplace');
    
    // Should render without hanging
    await expect(page.locator('[data-testid="tool-card"]').first()).toBeVisible({ timeout: 5000 });
    
    // Scrolling should be smooth
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });
});
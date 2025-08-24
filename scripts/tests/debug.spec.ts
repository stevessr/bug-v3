import { test, expect } from '@playwright/test';

test.describe('AI Generator Debug', () => {
  test('debug AI generator tab', async ({ page }) => {
    console.log('Starting AI generator debug test...');
    
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    
    // Set up console and error logging first
    page.on('console', msg => {
      const message = msg.text();
      console.log('CONSOLE:', message);
      consoleMessages.push(message);
    });
    page.on('pageerror', error => {
      const message = error.message;
      console.log('PAGE ERROR:', message);
      pageErrors.push(message);
    });
    
    await page.goto('/options.html');
    console.log('Navigated to options.html');
    
    await page.waitForLoadState('networkidle');
    console.log('Page loaded');
    
    // Wait for Vue to mount
    await page.waitForTimeout(3000);
    console.log('Waited for Vue to mount');
    
    // Check if AI generator tab exists
    const aiTab = page.locator('text=AI 图像生成器');
    const aiTabExists = await aiTab.isVisible();
    console.log('AI generator tab exists:', aiTabExists);
    
    if (aiTabExists) {
      // Click on AI generator tab
      await aiTab.click();
      console.log('Clicked AI generator tab');
      
      await page.waitForTimeout(2000);
      
      // Check what providers are available
      const providers = await page.locator('text=Cloudflare, text=OpenAI').allTextContents();
      console.log('Available providers:', providers);
      
      // Check if OpenAI provider button exists
      const openaiProviderButton = page.locator('text=OpenAI');
      const openaiExists = await openaiProviderButton.isVisible();
      console.log('OpenAI provider button exists:', openaiExists);
      
      if (openaiExists) {
        await openaiProviderButton.click();
        console.log('Clicked OpenAI provider');
        
        await page.waitForTimeout(1000);
        
        // Check what's visible after clicking OpenAI
        const pageContent = await page.locator('body').innerHTML();
        console.log('Page content after clicking OpenAI (first 1000 chars):', pageContent.substring(0, 1000));
        
        // Look for the OpenAI settings heading
        const openaiHeading = page.getByRole('heading', { name: '🤖 OpenAI 设置' });
        const headingExists = await openaiHeading.isVisible();
        console.log('OpenAI settings heading exists:', headingExists);
        
        // Check for any h4 elements
        const h4Elements = await page.locator('h4').allTextContents();
        console.log('All h4 elements:', h4Elements);
        
        // Check for text containing "OpenAI"
        const openaiTexts = await page.locator('text*=OpenAI').allTextContents();
        console.log('All texts containing OpenAI:', openaiTexts);
      }
    }
    
    console.log('All console messages:', consoleMessages.slice(-10)); // Last 10 messages
    console.log('All page errors:', pageErrors);
  });
});
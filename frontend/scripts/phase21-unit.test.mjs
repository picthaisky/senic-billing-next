import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resources } from '../src/i18n/resources.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');

function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

test('Phase 21 TH/EN i18n resources have full parity including Checkout, Forgot/Reset Password & Signup keys', () => {
  const thKeys = collectKeys(resources.th.translation).sort();
  const enKeys = collectKeys(resources.en.translation).sort();
  assert.deepEqual(thKeys, enKeys);

  for (const requiredKey of [
    'settings.checkoutModalTitle',
    'settings.billingMonthly',
    'settings.billingYearly',
    'settings.methodPromptPay',
    'settings.methodCard',
    'settings.methodBankTransfer',
    'settings.cardTokenRequired',
    'settings.checkStatusBtn',
    'auth.forgotPasswordLink',
    'auth.signupLink',
    'auth.resetTitle',
    'auth.signupTitle',
    'auth.createOrgBtn',
  ]) {
    assert.ok(thKeys.includes(requiredKey), `Missing key ${requiredKey}`);
  }
});

test('Phase 21 SettingsPage implements Checkout Modal with BillingCycle, PromptPay QR polling & Bank Transfer', () => {
  const settingsSrc = fs.readFileSync(path.join(frontendSrc, 'components', 'settings', 'SettingsPage.tsx'), 'utf8');
  assert.match(settingsSrc, /\/subscriptions\/checkout/);
  assert.match(settingsSrc, /\/subscriptions\/status\//);
  assert.match(settingsSrc, /paymentMethod/);
  assert.match(settingsSrc, /billingCycle/);
  assert.doesNotMatch(settingsSrc, /apiClient\.post\('\/subscriptions\/checkout',\s*\{\s*planId,\s*cardToken:\s*''\s*\}\)/);
});

test('Phase 21 LoginPage integrates Forgot Password, Reset Password, Self-Service Signup with zero raw Thai', () => {
  const loginSrc = fs.readFileSync(path.join(frontendSrc, 'components', 'auth', 'LoginPage.tsx'), 'utf8');
  assert.match(loginSrc, /\/auth\/forgot-password/);
  assert.match(loginSrc, /\/auth\/reset-password/);
  assert.match(loginSrc, /\/auth\/signup-tenant/);
  assert.match(loginSrc, /resetToken/);
  assert.doesNotMatch(loginSrc, /[\u0E00-\u0E7F]/, 'Expected zero hardcoded Thai characters in LoginPage.tsx');
});

test('Phase 21 bundled Thai PDF fonts, Dockerfile font packages & Gemini/e-Tax configs are wired', () => {
  const infraCsproj = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.Infrastructure', 'SenicBilling.Infrastructure.csproj'),
    'utf8'
  );
  assert.match(infraCsproj, /Fonts\\\*\.ttf|Fonts\/\*\.ttf/);
  assert.ok(fs.existsSync(path.join(repoRoot, 'backend', 'src', 'SenicBilling.Infrastructure', 'Fonts', 'Kanit-Regular.ttf')));
  assert.ok(fs.existsSync(path.join(repoRoot, 'backend', 'src', 'SenicBilling.Infrastructure', 'Fonts', 'Kanit-Bold.ttf')));

  const dockerfile = fs.readFileSync(path.join(repoRoot, 'backend', 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /fonts-thai-tlwg/);
  assert.match(dockerfile, /fontconfig/);

  const compose = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
  assert.match(compose, /Gemini__Model/);
  assert.match(compose, /ETax__CertificatePath/);

  const stackEnv = fs.readFileSync(path.join(repoRoot, 'stack.env'), 'utf8');
  assert.match(stackEnv, /GEMINI_MODEL=/);
  assert.match(stackEnv, /ETAX_CERT_PATH=/);
});

import { expect, test } from 'vitest';
import { createUpdateGate } from '../../src/updateGate';

test('an update waits while HeroPick is busy, then applies when idle', () => {
  let applied = 0;
  const gate = createUpdateGate(() => { applied++; });
  gate.setBusy(true);
  gate.updateReady();
  expect(applied).toBe(0);
  gate.setBusy(false);
  expect(applied).toBe(1);
});

test('an update applies straight away when idle', () => {
  let applied = 0;
  const gate = createUpdateGate(() => { applied++; });
  gate.setBusy(false);
  gate.updateReady();
  expect(applied).toBe(1);
});

test('nothing happens without an update, and it applies only once', () => {
  let applied = 0;
  const gate = createUpdateGate(() => { applied++; });
  gate.setBusy(true);
  gate.setBusy(false);
  expect(applied).toBe(0);
  gate.updateReady();
  gate.setBusy(true);
  gate.setBusy(false);
  expect(applied).toBe(1);
});

test('starts busy until told otherwise (the app decides when it is safe)', () => {
  let applied = 0;
  const gate = createUpdateGate(() => { applied++; });
  gate.updateReady();
  expect(applied).toBe(0);
});

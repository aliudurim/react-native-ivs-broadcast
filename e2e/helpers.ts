import { by, device, element, expect, waitFor } from 'detox';

type Matcher = Parameters<typeof element>[0];

const DEFAULT_TIMEOUT_MS = 20000;

export async function launch() {
  await device.launchApp({
    newInstance: true,
    permissions: { camera: 'YES', microphone: 'YES', notifications: 'YES' },
  });
}

export async function openExample(id: 'Broadcast' | 'Stage') {
  await waitFor(element(by.id(id)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT_MS);
  await element(by.id(id)).tap();
  await waitFor(element(by.id('eventLog')))
    .toExist()
    .withTimeout(DEFAULT_TIMEOUT_MS);
}

export async function goBack() {
  if (device.getPlatform() === 'android') {
    await device.pressBack();
  } else {
    await element(by.id('goBack')).tap();
  }
}

export async function tap(id: string) {
  await waitFor(element(by.id(id)))
    .toBeVisible()
    .whileElement(by.type(scrollViewType()))
    .scroll(80, 'down')
    .catch(() => {});
  await element(by.id(id)).tap();
}

export async function type(id: string, text: string) {
  await element(by.id(id)).replaceText(text);
  // Without a hardware keyboard (CI simulators) the software keyboard covers the buttons.
  await element(by.id(id)).tapReturnKey();
}

export async function clearLogs() {
  await element(by.id('clearLogs')).tap();
}

/** Waits for an event-log entry whose label is exactly `name ::: value`. */
export async function waitForLog(
  name: string,
  value: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  await waitFor(element(by.label(`${name} ::: ${value}`)).atIndex(0))
    .toExist()
    .withTimeout(timeoutMs);
}

/** Waits for any event-log entry with this name, then returns its label. */
export async function waitForEvent(
  name: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const match: Matcher = by.id(name);
  await waitFor(element(match).atIndex(0)).toExist().withTimeout(timeoutMs);
  const attributes = await element(match).atIndex(0).getAttributes();
  return 'label' in attributes ? String(attributes.label ?? '') : '';
}

/** Resolves with the first of `names` that shows up in the event log. */
export async function waitForAnyEvent(
  names: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const name of names) {
      try {
        await expect(element(by.id(name)).atIndex(0)).toExist();
        return name;
      } catch {
        // not logged yet
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`None of [${names.join(', ')}] was logged in ${timeoutMs}ms`);
}

export async function expectVisible(id: string) {
  await expect(element(by.id(id))).toBeVisible();
}

const scrollViewType = () =>
  device.getPlatform() === 'ios'
    ? 'RCTScrollView'
    : 'android.widget.ScrollView';

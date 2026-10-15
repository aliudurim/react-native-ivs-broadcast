import {
  clearLogs,
  expectVisible,
  goBack,
  launch,
  openExample,
  tap,
  type,
  waitForAnyEvent,
  waitForLog,
} from './helpers';

describe('IvsBroadcastView', () => {
  beforeAll(launch);

  beforeEach(async () => {
    await openExample('Broadcast');
    await clearLogs();
  });

  afterEach(goBack);

  it('mounts the native view', async () => {
    await expectVisible('broadcastView');
  });

  it('start() reports a missing rtmpsUrl through onError', async () => {
    await tap('start');
    await waitForLog('onError', "'rtmpsUrl' is empty.");
  });

  it('start() reports a missing streamKey through onError', async () => {
    await type('rtmpsUrl', 'rtmps://example.invalid:443/app/');
    await tap('start');
    await waitForLog('onError', "'streamKey' is empty.");
  });

  it('survives every runtime prop change', async () => {
    for (const id of ['front', 'muted', 'camera', 'mirrored']) {
      await tap(id);
      await tap(id);
    }
    await tap('aspect');
    await tap('aspect');
    await tap('aspect');
    await expectVisible('broadcastView');
  });

  it('start() against an unreachable ingest reports progress or an error', async () => {
    await type('rtmpsUrl', 'rtmps://example.invalid:443/app/');
    await type('streamKey', 'sk_us-west-2_e2e');
    await tap('start');
    await waitForAnyEvent(
      ['onBroadcastStateChanged', 'onBroadcastError', 'onError'],
      30000
    );
    await tap('stop');
  });
});

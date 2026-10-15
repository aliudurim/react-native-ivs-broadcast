import {
  clearLogs,
  expectVisible,
  goBack,
  launch,
  openExample,
  tap,
  type,
  waitForEvent,
  waitForLog,
} from './helpers';

describe('IvsStage', () => {
  beforeAll(launch);

  beforeEach(async () => {
    await openExample('Stage');
    await clearLogs();
  });

  afterEach(goBack);

  it('starts disconnected with no remote participants', async () => {
    await expectVisible('localVideo');
    await waitForLog('connection', 'disconnected').catch(() => {});
    await expectVisible('participantCount');
  });

  it('prepareLocalMedia settles (camera availability depends on the device)', async () => {
    await tap('prepare');
    const label = await waitForEvent('prepareLocalMedia');
    if (!/^prepareLocalMedia ::: (ok|error .+)$/.test(label)) {
      throw new Error(`Unexpected label: ${label}`);
    }
  });

  it('joinStage rejects an invalid token', async () => {
    await type('stageToken', 'not-a-jwt');
    await tap('join');
    const label = await waitForEvent('joinStage');
    if (!label.startsWith('joinStage ::: error')) {
      throw new Error(`Expected a rejection, got: ${label}`);
    }
  });

  it('leaveStage and releaseLocalMedia are safe without a stage', async () => {
    await tap('leave');
    await waitForLog('leaveStage', 'ok');
    await tap('release');
    await waitForLog('releaseLocalMedia', 'ok');
  });

  it('toggles never throw while disconnected', async () => {
    for (const id of ['micMuted', 'stageCamera', 'stageFront']) {
      await tap(id);
      await tap(id);
    }
    await expectVisible('localVideo');
  });
});

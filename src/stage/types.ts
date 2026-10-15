export type StageConnectionState = 'disconnected' | 'connecting' | 'connected';
export type PublishState = 'notPublished' | 'attemptingPublish' | 'published';
export type SubscribeState =
  'notSubscribed' | 'attemptingSubscribe' | 'subscribed';

export interface StageParticipant {
  participantId: string;
  userId: string;
  isLocal: boolean;
  /** Attributes from the participant token (IVS only allows string values). */
  attributes: Record<string, string>;
  publishState: PublishState;
  subscribeState: SubscribeState;
  hasVideo: boolean;
  hasAudio: boolean;
  videoMuted: boolean;
  audioMuted: boolean;
}

export interface StageError {
  code: number;
  message: string;
  isFatal: boolean;
}

export interface StageState {
  connection: StageConnectionState;
  localParticipantId: string | null;
  participants: Record<string, StageParticipant>;
  lastError: StageError | null;
}

export type StageEvent =
  | { type: 'snapshot'; state: Omit<StageState, 'lastError'> }
  | {
      type: 'connection';
      state: StageConnectionState;
      error: StageError | null;
    }
  | { type: 'joined'; participant: StageParticipant }
  | { type: 'left'; participantId: string }
  | { type: 'publishState'; participantId: string; state: PublishState }
  | { type: 'subscribeState'; participantId: string; state: SubscribeState }
  | {
      type: 'media';
      participantId: string;
      hasVideo: boolean;
      hasAudio: boolean;
      videoMuted: boolean;
      audioMuted: boolean;
    }
  | { type: 'error'; error: StageError };

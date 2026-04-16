import {
  MockAudioBuffer,
  MockAudioBufferSourceNode,
  MockAudioContext,
  MockGainNode,
} from './webAudioMock';

(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).GainNode = MockGainNode;
(globalThis as any).AudioBufferSourceNode = MockAudioBufferSourceNode;
(globalThis as any).AudioBuffer = MockAudioBuffer;

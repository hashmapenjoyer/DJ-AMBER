/**
 * Minimal Web Audio API mock for unit tests.
 * Tracks call history so tests can assert on scheduling behavior.
 */

export interface ParamCall {
  method: string;
  args: number[];
}

export class MockAudioParam {
  value = 1.0;
  private calls: ParamCall[] = [];

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ method: 'setValueAtTime', args: [value, time] });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'linearRampToValueAtTime', args: [value, time] });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'exponentialRampToValueAtTime', args: [value, time] });
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.calls.push({ method: 'cancelScheduledValues', args: [time] });
    return this;
  }

  getCalls(): ParamCall[] {
    return [...this.calls];
  }

  reset(): void {
    this.calls = [];
    this.value = 1.0;
  }
}

export class MockGainNode {
  gain = new MockAudioParam();
  connected: unknown[] = [];

  connect(dest: unknown): unknown {
    this.connected.push(dest);
    return dest;
  }

  disconnect(): void {
    this.connected = [];
  }
}

export class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  onended: (() => void) | null = null;
  connected: unknown[] = [];
  private startCalls: Array<[number, number, number]> = [];
  private stopCalls: number[] = [];

  connect(dest: unknown): unknown {
    this.connected.push(dest);
    return dest;
  }

  disconnect(): void {
    this.connected = [];
  }

  start(when = 0, offset = 0, duration = 0): void {
    this.startCalls.push([when, offset, duration]);
  }

  stop(when = 0): void {
    this.stopCalls.push(when);
  }

  triggerEnded(): void {
    this.onended?.();
  }

  getStartCalls(): Array<[number, number, number]> {
    return [...this.startCalls];
  }

  getStopCalls(): number[] {
    return [...this.stopCalls];
  }
}

export class MockAudioBuffer {
  readonly duration: number;
  readonly sampleRate: number;
  readonly numberOfChannels: number;

  constructor(duration: number, sampleRate = 44100, numberOfChannels = 2) {
    this.duration = duration;
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
  }
}

export class MockAudioContext {
  currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new MockGainNode();

  private gainNodes: MockGainNode[] = [];
  private sourceNodes: MockAudioBufferSourceNode[] = [];
  private decodeDuration = 180;

  createGain(): MockGainNode {
    const node = new MockGainNode();
    this.gainNodes.push(node);
    return node;
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const node = new MockAudioBufferSourceNode();
    this.sourceNodes.push(node);
    return node;
  }

  async decodeAudioData(_buf: ArrayBuffer): Promise<MockAudioBuffer> {
    return new MockAudioBuffer(this.decodeDuration);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }

  // test helpers

  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  setDecodedDuration(duration: number): void {
    this.decodeDuration = duration;
  }

  getCreatedGainNodes(): MockGainNode[] {
    return [...this.gainNodes];
  }

  getCreatedSourceNodes(): MockAudioBufferSourceNode[] {
    return [...this.sourceNodes];
  }
}

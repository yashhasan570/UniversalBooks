// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { TTSClient, TTSMessageEvent } from '@/services/tts/TTSClient';
import type { TTSGranularity, TTSVoice } from '@/services/tts/types';
import type { FoliateView } from '@/types/view';
import type { AppService } from '@/types/system';

// Controller wiring of UniversalBooks Voice: a BufferedTTSClient over the UniversalBooks
// provider, sharing Edge's per-book cache store, registered everywhere the
// controller used to know only Edge.

const h = vi.hoisted(() => ({
  edgeArgs: [] as unknown[][],
  bufferedArgs: [] as unknown[][],
  universalbooksClient: null as Record<string, unknown> | null,
  warmup: vi.fn(),
  store: { get: async () => null, put: async () => {} },
  universalbooksInit: true,
  // The UniversalBooks server never answers (init and voice list hang).
  universalbooksHang: false,
  universalbooksVoices: [] as TTSVoice[],
  customClient: null as Record<string, unknown> | null,
  customInit: true,
  customVoices: null as TTSVoice[] | null,
  customArgs: [] as unknown[],
}));

function mockClient(name: string): TTSClient {
  return {
    name,
    initialized: false,
    init: vi.fn().mockImplementation(async function (this: { initialized: boolean }) {
      this.initialized = true;
      return true;
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    speak: vi.fn().mockImplementation(async function* (): AsyncGenerator<TTSMessageEvent> {
      yield { code: 'end' };
    }),
    pause: vi.fn().mockResolvedValue(true),
    resume: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(undefined),
    setPrimaryLang: vi.fn(),
    setRate: vi.fn().mockResolvedValue(undefined),
    setPitch: vi.fn().mockResolvedValue(undefined),
    setVoice: vi.fn().mockResolvedValue(undefined),
    getAllVoices: vi.fn().mockResolvedValue([]),
    getVoices: vi.fn().mockResolvedValue([]),
    getGranularities: vi.fn().mockReturnValue(['sentence'] as TTSGranularity[]),
    getCapabilities: vi.fn().mockReturnValue({
      wordBoundaries: true,
      mediaClock: true,
      gapControl: true,
      liveRateChange: false,
    }),
    getVoiceId: vi.fn().mockReturnValue('voice-1'),
    getSpeakingLang: vi.fn().mockReturnValue('en'),
  };
}

const bufferedExtras = () => ({
  setSentenceGap: vi.fn(),
  setParagraphGap: vi.fn(),
  canDownload: vi.fn().mockReturnValue(true),
  getSectionCacheStatuses: vi.fn().mockResolvedValue(new Map()),
  getCacheBytes: vi.fn().mockResolvedValue(0),
  beginDownloadSections: vi.fn(),
  completeDownloadSections: vi.fn(),
  cancelDownloadSections: vi.fn(),
  clearDownloads: vi.fn(),
});

vi.mock('@/services/tts/WebSpeechClient', () => ({
  WebSpeechClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    Object.assign(this, mockClient('web-speech'));
  }),
}));
vi.mock('@/services/tts/EdgeTTSClient', () => ({
  // constants.ts imports this from here (circular import in production code).
  DEFAULT_SENTENCE_GAP_SEC: 0.15,
  EdgeTTSClient: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    ...args: unknown[]
  ) {
    h.edgeArgs.push(args);
    Object.assign(this, mockClient('edge-tts'), bufferedExtras());
    (this['getAllVoices'] as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'en-US-AriaNeural', name: 'Aria', lang: 'en-US' },
    ]);
  }),
}));
vi.mock('@/services/tts/NativeTTSClient', () => ({
  NativeTTSClient: vi.fn(),
}));
vi.mock('@/services/tts/BufferedTTSClient', () => ({
  BufferedTTSClient: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
    ...args: unknown[]
  ) {
    if ((args[0] as { id: string }).id === 'custom-tts') {
      Object.assign(this, mockClient('custom-tts'), bufferedExtras());
      (this['init'] as ReturnType<typeof vi.fn>).mockImplementation(async function (this: {
        initialized: boolean;
      }) {
        this.initialized = h.customInit;
        return h.customInit;
      });
      (this['getAllVoices'] as ReturnType<typeof vi.fn>).mockImplementation(
        async () => h.customVoices ?? CUSTOM_VOICES,
      );
      (this['getVoices'] as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'custom-tts:svc', name: 'My TTS', voices: CUSTOM_VOICES },
      ]);
      h.customClient = this;
      h.customArgs = args;
      return;
    }
    h.bufferedArgs.push(args);
    Object.assign(this, mockClient('universalbooks-tts'), bufferedExtras());
    (this['init'] as ReturnType<typeof vi.fn>).mockImplementation(async function (this: {
      initialized: boolean;
    }) {
      if (h.universalbooksHang) return new Promise<boolean>(() => {});
      this.initialized = h.universalbooksInit;
      return h.universalbooksInit;
    });
    (this['getAllVoices'] as ReturnType<typeof vi.fn>).mockImplementation(() =>
      h.universalbooksHang ? new Promise(() => {}) : Promise.resolve(h.universalbooksVoices),
    );
    h.universalbooksClient = this;
  }),
}));
vi.mock('@/services/tts/providers/universalbooks', () => ({
  UniversalBooksVoiceProvider: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    Object.assign(this, { id: 'universalbooks-tts', warmup: h.warmup });
  }),
}));
vi.mock('@/services/tts/providers/openaiCompatible', () => ({
  OpenAICompatibleSpeechProvider: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    Object.assign(this, { id: 'custom-tts' });
  }),
}));
vi.mock('@/services/tts/providers/bookCacheStore', async (orig) => ({
  ...(await orig<typeof import('@/services/tts/providers/bookCacheStore')>()),
  createBookTTSCacheStore: vi.fn(() => h.store),
}));
vi.mock('@/services/tts/TTSUtils', () => ({
  TTSUtils: {
    getPreferredClient: vi.fn().mockReturnValue(null),
    getPreferredClientForLang: vi.fn().mockReturnValue(null),
    setPreferredClient: vi.fn(),
    setPreferredVoice: vi.fn(),
    getPreferredVoice: vi.fn().mockReturnValue(null),
  },
}));
vi.mock('foliate-js/overlayer.js', () => ({ Overlayer: { highlight: 'highlightFn' } }));
vi.mock('@/utils/node', () => ({ createRejectFilter: vi.fn(() => () => 1) }));

import { TTSController } from '@/services/tts/TTSController';
import { TTSUtils } from '@/services/tts/TTSUtils';
import { CachingProvider } from '@/services/tts/providers/cache';
import { createBookTTSCacheStore } from '@/services/tts/providers/bookCacheStore';

const CUSTOM_VOICES = [
  { id: 'svc:nova', name: 'nova', lang: 'mul' },
  { id: 'kok:af_heart', name: 'af_heart', lang: 'en-US' },
];
const UNIVERSALBOOKS_VOICES = [{ id: 'kokoro:af_heart', name: 'Heart', lang: 'en-US' }];
const view = {
  renderer: { primaryIndex: 0, getContents: vi.fn().mockReturnValue([]) },
  book: { sections: [] },
  language: { isCJK: false },
  tts: null,
} as unknown as FoliateView;
const appService = { isAndroidApp: false, isIOSApp: false } as unknown as AppService;

let controller: TTSController;
const universalbooks = () => h.universalbooksClient as unknown as TTSClient & ReturnType<typeof bufferedExtras>;
const custom = () => h.customClient as unknown as TTSClient & ReturnType<typeof bufferedExtras>;
const edge = () => controller.ttsEdgeClient as unknown as ReturnType<typeof bufferedExtras>;

beforeEach(() => {
  h.edgeArgs = [];
  h.bufferedArgs = [];
  h.universalbooksInit = true;
  h.universalbooksVoices = UNIVERSALBOOKS_VOICES;
  h.customInit = true;
  h.customVoices = null;
  h.warmup.mockReset();
  vi.mocked(TTSUtils.getPreferredClient).mockReturnValue(null);
  vi.mocked(TTSUtils.getPreferredClientForLang).mockReturnValue(null);
  vi.mocked(createBookTTSCacheStore).mockClear();
  controller = new TTSController(appService, view, true);
});

afterEach(() => vi.clearAllMocks());

describe('construction', () => {
  test('Edge and UniversalBooks share one per-book cache store', () => {
    expect(createBookTTSCacheStore).toHaveBeenCalledTimes(1);
    expect(h.edgeArgs[0]![2]).toBe(h.store);
    const provider = h.bufferedArgs[0]![0];
    expect(provider).toBeInstanceOf(CachingProvider);
    expect((provider as CachingProvider).id).toBe('universalbooks-tts');
  });

  test('without a cache store the provider is used directly', () => {
    vi.mocked(createBookTTSCacheStore).mockReturnValueOnce(null);
    h.bufferedArgs = [];
    new TTSController(appService, view, true);
    expect(h.bufferedArgs[0]![0]).not.toBeInstanceOf(CachingProvider);
  });
});

describe('init', () => {
  test('an engine that never answers does not hold up init or the other engines', async () => {
    vi.useFakeTimers();
    h.universalbooksHang = true;
    try {
      vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('universalbooks-tts');
      let done = false;
      void controller.init().then(() => (done = true));
      await vi.advanceTimersByTimeAsync(14_000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(done).toBe(true);
      // UniversalBooks Voice is unavailable this session; Edge reads.
      expect(controller.ttsClient.name).toBe('edge-tts');
    } finally {
      h.universalbooksHang = false;
      vi.useRealTimers();
    }
  });

  test('UniversalBooks Voice is available but Edge stays the default engine', async () => {
    await controller.init();
    expect(universalbooks().init).toHaveBeenCalled();
    expect(controller.ttsClient.name).toBe('edge-tts');
    expect(controller.ttsUniversalBooksVoices).toEqual(UNIVERSALBOOKS_VOICES);
  });

  test('a remembered UniversalBooks preference selects it', async () => {
    vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('universalbooks-tts');
    await controller.init();
    expect(controller.ttsClient).toBe(universalbooks());
  });
});

describe('voices', () => {
  test('lists the UniversalBooks group after native and before Edge, and warms the worker', async () => {
    h.customInit = false;
    await controller.init();
    vi.mocked(universalbooks().getVoices).mockResolvedValue([
      { id: 'universalbooks-tts', name: 'UniversalBooks Voice', voices: UNIVERSALBOOKS_VOICES },
    ]);
    vi.mocked(controller.ttsEdgeClient.getVoices).mockResolvedValue([
      { id: 'edge-tts', name: 'Edge TTS', voices: [] },
    ]);
    const groups = await controller.getVoices('en');
    expect(groups.map((g) => g.id)).toEqual(['universalbooks-tts', 'edge-tts']);
    expect(h.warmup).toHaveBeenCalledTimes(1);
  });

  test('shows the UniversalBooks group greyed out to readers whose plan lacks it', async () => {
    h.universalbooksVoices = UNIVERSALBOOKS_VOICES.map((voice) => ({ ...voice, disabled: true }));
    await controller.init();
    const locked = UNIVERSALBOOKS_VOICES.map((voice) => ({ ...voice, disabled: true }));
    vi.mocked(universalbooks().getVoices).mockResolvedValue([
      { id: 'universalbooks-tts', name: 'UniversalBooks Voice', voices: locked, disabled: true },
    ]);
    const groups = await controller.getVoices('en');
    expect(groups.find((g) => g.id === 'universalbooks-tts')?.voices).toEqual(locked);
    expect(h.warmup).not.toHaveBeenCalled();
  });
});

describe('book language', () => {
  test('a remembered UniversalBooks choice yields to Edge for a language it has no voice for', async () => {
    vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('universalbooks-tts');
    await controller.init();
    expect(controller.ttsClient).toBe(universalbooks());
    await controller.setLang('de');
    expect(controller.ttsClient.name).toBe('edge-tts');
    // The choice itself is kept for books UniversalBooks Voice can read.
    expect(TTSUtils.setPreferredClient).not.toHaveBeenCalled();
  });

  test('a remembered UniversalBooks choice yields to Edge when the plan lacks every voice', async () => {
    h.universalbooksVoices = UNIVERSALBOOKS_VOICES.map((voice) => ({ ...voice, disabled: true }));
    vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('universalbooks-tts');
    await controller.init();
    await controller.setLang('en-US');
    expect(controller.ttsClient.name).toBe('edge-tts');
  });

  test('keeps UniversalBooks Voice for a language it can voice', async () => {
    vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('universalbooks-tts');
    await controller.init();
    await controller.setLang('en-GB');
    expect(controller.ttsClient).toBe(universalbooks());
  });

  test('the picker hides an empty UniversalBooks group', async () => {
    await controller.init();
    vi.mocked(universalbooks().getVoices).mockResolvedValue([
      { id: 'universalbooks-tts', name: 'UniversalBooks Voice', voices: [], disabled: true },
    ]);
    const groups = await controller.getVoices('de');
    expect(groups.map((g) => g.id)).not.toContain('universalbooks-tts');
    expect(h.warmup).not.toHaveBeenCalled();
  });
});

describe('default voice per language', () => {
  test("the engine chosen for the book's language wins over the global one", async () => {
    vi.mocked(TTSUtils.getPreferredClientForLang).mockImplementation((lang) =>
      lang.startsWith('en') ? 'universalbooks-tts' : null,
    );
    await controller.init();
    expect(controller.ttsClient.name).toBe('edge-tts');
    await controller.setLang('en-US');
    expect(controller.ttsClient).toBe(universalbooks());
    await controller.setLang('de');
    expect(controller.ttsClient.name).toBe('edge-tts');
  });

  test('an engine that failed to start is passed over', async () => {
    h.universalbooksInit = false;
    vi.mocked(TTSUtils.getPreferredClientForLang).mockReturnValue('universalbooks-tts');
    await controller.init();
    await controller.setLang('en');
    expect(controller.ttsClient.name).toBe('edge-tts');
  });

  test("picking a voice remembers its engine for the book's language", async () => {
    await controller.init();
    await controller.setLang('en-GB');
    await controller.setVoice('kokoro:af_heart', 'en-US');
    expect(TTSUtils.setPreferredClient).toHaveBeenCalledWith('universalbooks-tts', 'en-GB');
  });
});

describe('setVoice', () => {
  test("the engine-default voice ('') never selects UniversalBooks Voice", async () => {
    await controller.init();
    await controller.setVoice('', 'en');
    expect(controller.ttsClient.name).toBe('edge-tts');
  });

  test('a UniversalBooks voice selects the UniversalBooks client', async () => {
    await controller.init();
    await controller.setVoice('kokoro:af_heart', 'en');
    expect(controller.ttsClient).toBe(universalbooks());
    expect(TTSUtils.setPreferredClient).toHaveBeenCalledWith('universalbooks-tts', '');
    expect(universalbooks().setVoice).toHaveBeenCalledWith('kokoro:af_heart');
  });

  test('a voice the plan lacks never selects UniversalBooks Voice', async () => {
    h.universalbooksVoices = [
      ...UNIVERSALBOOKS_VOICES,
      { id: 'omnivoice:clara', name: 'Clara', lang: 'en-US', disabled: true },
    ];
    await controller.init();
    await controller.setVoice('omnivoice:clara', 'en');
    expect(controller.ttsClient).not.toBe(universalbooks());
  });
});

describe('settings fan out to the UniversalBooks client', () => {
  test('primary language, gaps and shutdown', async () => {
    await controller.init();
    await controller.setPrimaryLang('en');
    controller.setSentenceGap(0.2);
    controller.setParagraphGap(0.5);
    await controller.shutdown();
    expect(universalbooks().setPrimaryLang).toHaveBeenCalledWith('en');
    expect(universalbooks().setSentenceGap).toHaveBeenCalledWith(0.2);
    expect(universalbooks().setParagraphGap).toHaveBeenCalledWith(0.5);
    expect(universalbooks().shutdown).toHaveBeenCalled();
  });
});

describe('downloads follow the active synthetic engine', () => {
  test('Edge by default, UniversalBooks Voice when it is the active client', async () => {
    await controller.init();
    await controller.clearDownloads();
    expect(edge().clearDownloads).toHaveBeenCalledTimes(1);
    await controller.setVoice('kokoro:af_heart', 'en');
    await controller.clearDownloads();
    await controller.beginDownloadSections([1]);
    expect(universalbooks().clearDownloads).toHaveBeenCalledTimes(1);
    expect(universalbooks().beginDownloadSections).toHaveBeenCalledWith([1]);
    expect(controller.canDownload()).toBe(true);
    expect(universalbooks().canDownload).toHaveBeenCalled();
  });
});

describe('custom TTS services', () => {
  test('share the per-book cache store and are never the default engine', async () => {
    expect(controller.ttsCustomClient).toBe(custom());
    expect(h.customArgs[0]).toBeInstanceOf(CachingProvider);
    expect((h.customArgs[0] as CachingProvider).id).toBe('custom-tts');
    await controller.init();
    expect(custom().init).toHaveBeenCalled();
    expect(controller.ttsClient.name).toBe('edge-tts');
    vi.mocked(TTSUtils.getPreferredClient).mockReturnValue('custom-tts');
    await controller.init();
    expect(controller.ttsClient).toBe(custom());
  });

  test('list their groups right after narration, for any language', async () => {
    await controller.init();
    vi.mocked(universalbooks().getVoices).mockResolvedValue([
      { id: 'universalbooks-tts', name: 'UniversalBooks Voice', voices: UNIVERSALBOOKS_VOICES },
    ]);
    vi.mocked(controller.ttsEdgeClient.getVoices).mockResolvedValue([
      { id: 'edge-tts', name: 'Edge TTS', voices: [] },
    ]);
    const groups = await controller.getVoices('de');
    expect(groups.map((g) => g.id)).toEqual(['custom-tts:svc', 'universalbooks-tts', 'edge-tts']);
  });

  test('are hidden when unavailable (free plan, no services)', async () => {
    h.customInit = false;
    await controller.init();
    const groups = await controller.getVoices('en');
    expect(groups.map((g) => g.id)).not.toContain('custom-tts:svc');
  });

  test('a custom voice selects the custom client, which keeps it for any language', async () => {
    await controller.init();
    await controller.setVoice('svc:nova', 'en');
    expect(controller.ttsClient).toBe(custom());
    expect(TTSUtils.setPreferredClient).toHaveBeenCalledWith('custom-tts', '');
    expect(custom().setVoice).toHaveBeenCalledWith('svc:nova');
    await controller.setLang('ja');
    expect(controller.ttsClient).toBe(custom());
  });

  test('a service without a voice for the book language yields to the default engine', async () => {
    h.customVoices = [CUSTOM_VOICES[1]!];
    await controller.init();
    await controller.setVoice('kok:af_heart', 'en-US');
    await controller.setLang('en-GB');
    expect(controller.ttsClient).toBe(custom());
    await controller.setLang('ja');
    expect(controller.ttsClient.name).toBe('edge-tts');
  });

  test('settings, downloads and shutdown fan out to the custom client', async () => {
    await controller.init();
    await controller.setVoice('svc:nova', 'en');
    await controller.setPrimaryLang('en');
    controller.setSentenceGap(0.2);
    controller.setParagraphGap(0.5);
    await controller.clearDownloads();
    await controller.shutdown();
    expect(custom().setPrimaryLang).toHaveBeenCalledWith('en');
    expect(custom().setSentenceGap).toHaveBeenCalledWith(0.2);
    expect(custom().setParagraphGap).toHaveBeenCalledWith(0.5);
    expect(custom().clearDownloads).toHaveBeenCalledTimes(1);
    expect(custom().shutdown).toHaveBeenCalled();
  });
});

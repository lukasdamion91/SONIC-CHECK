import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { resolveAccessPolicy, canStartScan, scanDenialCopy } from '../src/lib/accessPolicy.mjs';
import { refreshAfterCreditAttempt } from '../src/lib/userActions.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const babel = require('@babel/core');
// Real components rendered locally. External services and cosmetic primitives
// are controlled fixtures, not real login, network, provider or billing calls.
function loadComponent(relative, mocks) {
  const filename = new URL(relative, import.meta.url).pathname;
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,React){${code}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports, React,
  );
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
async function mount(Component) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(Component)));
  return { container, rerender: async () => { await act(async () => root.render(React.createElement(Component))); }, close: async () => { await act(async () => root.unmount()); container.remove(); } };
}
function authHarness(getAuth, getUser, api) {
  process.env.REACT_APP_CLERK_PUBLISHABLE_KEY = 'pk_test_local_controlled_fixture';
  return loadComponent('../src/context/AuthContext.jsx', {
    '@clerk/react': { ClerkProvider: ({ children }) => children, useAuth: getAuth, useUser: () => ({ user: getUser() }) },
    '@/lib/api': { api, setApiTokenProvider: () => {}, formatApiErrorDetail: String },
    '@/lib/accessPolicy.mjs': { canStartScan },
  });
}
const initialAuth = () => ({ userId: 'A', isLoaded: true, isSignedIn: true, getToken: async () => 'fixture', signOut: async () => {} });
test('auth discards stale account sync responses before they can fetch under another owner', async () => {
  const pendingA = deferred(); let auth = initialAuth(); let meCalls = 0;
  const mod = authHarness(() => auth, () => ({ id: auth.userId, fullName: 'Same Name' }), {
    post: () => auth.userId === 'A' ? pendingA.promise : Promise.resolve({}),
    get: async () => { meCalls++; return { data: { id: auth.userId } }; },
  });
  function Child() { const value = mod.useAuth(); return React.createElement('div', null, value.loading ? 'loading' : value.user?.id || 'signed-out'); }
  const App = () => React.createElement(mod.AuthProvider, null, React.createElement(Child));
  const view = await mount(App); assert.equal(view.container.textContent, 'loading');
  auth = { ...auth, userId: 'B' }; await view.rerender(); await flush(); assert.equal(view.container.textContent, 'B');
  pendingA.resolve({}); await flush(); assert.equal(view.container.textContent, 'B'); assert.equal(meCalls, 1);
  auth = { ...auth, userId: null, isSignedIn: false }; await view.rerender(); assert.equal(view.container.textContent, 'signed-out'); await view.close();
});
test('auth remounts private children across owners with identical names', async () => {
  let auth = initialAuth(); let mounts = 0, cleanups = 0;
  const mod = authHarness(() => auth, () => ({ id: auth.userId, fullName: 'Same Name' }), { post: async () => ({}), get: async () => ({ data: { id: auth.userId } }) });
  function Child() { const [owner] = React.useState(auth.userId); React.useEffect(() => { mounts++; return () => { cleanups++; }; }, []); return React.createElement('div', null, owner); }
  const App = () => React.createElement(mod.AuthProvider, null, React.createElement(Child));
  const view = await mount(App); assert.equal(view.container.textContent, 'A');
  auth = { ...auth, userId: 'B' }; await view.rerender(); assert.equal(view.container.textContent, 'B'); assert.equal(mounts, 2); assert.equal(cleanups, 1); await view.close();
});
function libraryHarness(api, refresh, navigate = () => {}) {
  const emptyIcon = () => null;
  return loadComponent('../src/pages/Library.jsx', {
    'react-router-dom': { Link: ({ children }) => React.createElement('span', null, children), useNavigate: () => navigate },
    'lucide-react': { FileAudio: emptyIcon, Loader2: emptyIcon, Play: emptyIcon, RefreshCw: emptyIcon },
    sonner: { toast: { error: () => {}, success: () => {} } },
    '@/components/ui/button': { Button: ({ children, ...props }) => React.createElement('button', props, children) },
    '@/context/AuthContext': { hasScanEntitlement: canStartScan, useAuth: () => ({ user: { id: 'A', plan: 'pro_annual' }, refresh }) },
    '@/lib/api': { api, formatApiErrorDetail: String },
    '@/lib/accessPolicy.mjs': { resolveAccessPolicy, scanDenialCopy },
    '@/lib/userActions.mjs': { refreshAfterCreditAttempt },
  }).default;
}
const record = { id: 'fixture-scan', title: 'Controlled audio', created_at: '2026-11-07', audio_filename: 'controlled.wav' };
const click = async (view, label) => { const button = [...view.container.querySelectorAll('button')].find(b => b.textContent === label); assert.ok(button); await act(async () => button.click()); };
test('library refreshes server credits after ambiguous rescreen failure and prevents repeated submits', async () => {
  const post = deferred(); let posts = 0, refreshes = 0, navigations = 0;
  const Component = libraryHarness({ get: async () => ({ data: [record] }), post: () => { posts++; return post.promise; } }, async () => { refreshes++; }, () => { navigations++; });
  const view = await mount(Component); await click(view, 'Re-screen'); await click(view, 'Re-screen'); assert.equal(posts, 1);
  post.reject(new Error('response lost after possible debit')); await flush(); assert.equal(refreshes, 1); assert.equal(navigations, 0); await view.close();
});
test('library ignores late audio after unmount and revokes loaded audio when leaving', async () => {
  const pending = deferred(); let creates = 0; const revoked = [];
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => { creates++; return 'blob:controlled'; }; URL.revokeObjectURL = url => revoked.push(url);
  try {
    const Component = libraryHarness({ get: path => path === '/library' ? Promise.resolve({ data: [record] }) : pending.promise }, async () => {});
    const view = await mount(Component); await click(view, 'Load audio'); await view.close();
    pending.resolve({ data: new Blob(['fixture']) }); await flush(); assert.equal(creates, 0);
    const next = await mount(Component); await click(next, 'Load audio'); assert.equal(creates, 1); await next.close(); assert.deepEqual(revoked, ['blob:controlled']);
  } finally { URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
});
test('library successful rescreen refreshes credits before opening the new record', async () => {
  const events = [];
  const Component = libraryHarness({ get: async () => ({ data: [record] }), post: async () => ({ data: { id: 'new-fixture' } }) }, async () => { events.push('refresh'); }, path => events.push(path));
  const view = await mount(Component); await click(view, 'Re-screen');
  assert.deepEqual(events, ['refresh', '/app/scans/new-fixture']); await view.close();
});
test('library late rescreen completion does not navigate after leaving', async () => {
  const pending = deferred(); const events = [];
  const Component = libraryHarness({ get: async () => ({ data: [record] }), post: () => pending.promise }, async () => { events.push('refresh'); }, path => events.push(path));
  const view = await mount(Component); await click(view, 'Re-screen'); await view.close(); pending.resolve({ data: { id: 'late-fixture' } }); await flush();
  assert.deepEqual(events, ['refresh']);
});

// Customer input routes use the real form, validation, progress reducer and
// completion code. The API boundary remains a deliberately simulated service.
const uploadModule = await import('../src/lib/audioUpload.mjs');
const progressModule = await import('../src/lib/scanProgress.mjs');
const pollingModule = await import('../src/lib/scanProgressPolling.mjs');
const diagnosticsModule = await import('../src/lib/savedDiagnosticsPresentation.mjs');
for (const mode of ['audio', 'lyrics', 'combined']) {
  test(`customer ${mode} submission reaches a saved-record route, with expanded saved diagnostics`, async () => {
    const events = []; let submitted;
    const navigate = path => events.push(path), refresh = async () => events.push('refresh');
    const noop = () => {}, empty = () => null;
    const field = tag => ({ children, ...props }) => React.createElement(tag, props, children);
    const wrap = ({ children }) => React.createElement('div', null, children);
    const NewScan = loadComponent('../src/pages/NewScan.jsx', {
      'react-router-dom': { Link: wrap, useNavigate: () => navigate },
      'lucide-react': { FileAudio: empty, FileText: empty, Loader2: empty, ShieldAlert: empty, Upload: empty },
      sonner: { toast: { error: noop, success: noop, message: noop } },
      '@/components/ScannerAnalyzer': empty, '@/components/ScanResultsOverview': empty,
      '@/components/ui/button': { Button: field('button') }, '@/components/ui/input': { Input: field('input') },
      '@/components/ui/label': { Label: field('label') }, '@/components/ui/textarea': { Textarea: field('textarea') },
      '@/components/ui/select': { Select: wrap, SelectContent: wrap, SelectItem: wrap, SelectTrigger: wrap, SelectValue: empty },
      '@/constants/testIds': { SCAN: {} },
      '@/context/AuthContext': { useAuth: () => ({ user: { id: 'controlled-owner', name: 'Controlled customer', region: 'AU' }, refresh }) },
      '@/context/ResonanceContext': { useResonance: () => ({ setProgress: noop, release: noop }) },
      '@/lib/api': { api: {
        get: async path => path === '/regions' ? { data: [{ code: 'AU', name: 'Australia' }] } : { data: null },
        post: async (path, payload) => { assert.equal(path, '/scans/upload'); submitted = payload; return { data: { id: `saved-${mode}` } }; },
      }, formatApiErrorDetail: String },
      '@/lib/audioUpload.mjs': uploadModule, '@/lib/scanProgress.mjs': progressModule,
      '@/lib/scanProgressPolling.mjs': pollingModule,
    }).default;
    const oldFormData = globalThis.FormData; globalThis.FormData = dom.window.FormData;
    let view;
    try {
      view = await mount(NewScan);
      // Invoke the actual React input callbacks through their attached props;
      // this avoids jsdom's browser-specific file picker implementation.
      const change = async (id, value) => {
        const element = view.container.querySelector(`#${id}`); assert.ok(element);
        const key = Object.keys(element).find(k => k.startsWith('__reactProps$'));
        await act(async () => element[key].onChange({ target: value }));
      };
      await change('title', { value: `Controlled ${mode}` });
      if (mode !== 'audio') await change('lyrics', { value: 'Original synthetic fixture words for local testing only.' });
      if (mode !== 'lyrics') await change('audio', { files: [new dom.window.File(['RIFFcontrolled-test'], 'controlled.wav', { type: 'audio/wav' })] });
      await act(async () => view.container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(submitted.get('title'), `Controlled ${mode}`);
      assert.equal(Boolean(submitted.get('file')), mode !== 'lyrics');
      assert.equal(Boolean(submitted.get('lyrics')), mode !== 'audio');
      assert.equal(submitted.has('candidate_shadow'), false);
      assert.deepEqual(events, ['refresh', `/app/scans/saved-${mode}`]);
      await view.close(); view = null;
      const SavedDiagnostics = loadComponent('../src/components/SavedAudioDiagnostics.jsx', { '@/lib/savedDiagnosticsPresentation.mjs': diagnosticsModule }).default;
      const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/saved-analysis-extensions.json', import.meta.url), 'utf8'));
      const Results = () => React.createElement(SavedDiagnostics, { extension: fixture.analysis_extensions || fixture });
      view = await mount(Results);
      assert.match(view.container.textContent, /Additional audio measurements/);
      for (const heading of ['Frequency spectrum', 'Levels and dynamics', 'Timbre and tempo', 'Vocal and lyric evidence', 'Final evidence review']) {
        assert.ok(view.container.textContent.includes(heading), heading);
      }
      assert.match(view.container.textContent, /Supplied lyric text is not an audio transcription/);
      assert.match(view.container.textContent, /These measurements add no points/);
    } finally { if (view) await view.close(); globalThis.FormData = oldFormData; }
  });
}

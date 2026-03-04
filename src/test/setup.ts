// Polyfill IndexedDB for all tests using an in-memory implementation.
// This must run before any test file imports the Dexie db singleton.
import 'fake-indexeddb/auto';

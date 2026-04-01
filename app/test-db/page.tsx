'use client';

import { useActionState } from 'react';
import { runTestDbCheck, type TestDbState } from './actions';

const initialState: TestDbState = {
  ok: false,
  summary: 'No test submitted yet.',
  submitted: {
    usernameRaw: '',
    passwordLength: 0,
    receivedAt: '',
  },
  normalized: {
    username: null,
    password: null,
  },
  keyConfig: {
    hasPublishableKey: false,
    hasServiceRoleKey: false,
    serviceRoleLooksPublishable: false,
    hasUsablePrivilegedKey: false,
  },
  database: {
    products: {
      ok: false,
      sampleCount: 0,
      firstSku: null,
      error: null,
    },
    appUsers: {
      ok: false,
      userFound: null,
      passwordMatched: null,
      sampleUsernames: [],
      error: null,
    },
  },
};

export default function TestDbPage() {
  const [state, formAction, pending] = useActionState(
    runTestDbCheck,
    initialState
  );

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <h1>Test DB / Login Payload Checker</h1>
      <p>
        This page verifies both request payload delivery and Supabase database
        accessibility.
      </p>
      <p>
        Note: your current schema uses <code>bigint</code> for both username
        and password, so input must be digits only.
      </p>

      <form action={formAction} style={{ display: 'grid', gap: 12 }}>
        <label>
          Username (digits only)
          <input
            name="username"
            placeholder="e.g. 10001"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          Password (digits only)
          <input
            name="password"
            type="password"
            placeholder="e.g. 123456"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <button type="submit" disabled={pending} style={{ width: 180 }}>
          {pending ? 'Testing...' : 'Run Test'}
        </button>
      </form>

      <h2 style={{ marginTop: 24 }}>Summary</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{state.summary}</pre>

      <h2>Full Result (JSON)</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f6f8fa',
          border: '1px solid #d0d7de',
          borderRadius: 8,
          padding: 12,
        }}
      >
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}

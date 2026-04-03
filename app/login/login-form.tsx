'use client';

import { useActionState } from 'react';
import { Button, Card, Input } from 'antd';
import Text from 'antd/es/typography/Text';
import { login } from './actions';

const initialLoginState = {
  error: null as string | null,
};

type LoginFormProps = {
  redirectTo: string;
};

export default function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, initialLoginState);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Card title="远宏交通仓库管理系统" style={{ width: 360 }}>
        <form action={formAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <label>
            <Text strong>账号</Text>
            <Input
              name="username"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="username"
              placeholder="请输入账号"
              required
            />
          </label>

          <label>
            <Text strong>密码</Text>
            <Input.Password
              name="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="请输入密码"
              autoComplete="current-password"
              required
            />
          </label>

          {state.error ? (
            <Text type="danger" aria-live="polite">
              {state.error}
            </Text>
          ) : null}

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={pending}
            disabled={pending}
          >
            登录
          </Button>
        </form>
      </Card>
    </div>
  );
}


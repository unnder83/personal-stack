export type User = {
  id: number
  username: string
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.message === 'string') {
      return data.message
    }
  } catch {
    // 非 JSON 响应，回退到状态码提示
  }
  return `请求失败（HTTP ${response.status}）`
}

export async function login(username: string, password: string): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}

export async function fetchMe(): Promise<User> {
  const response = await fetch('/api/auth/me')
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json()
}

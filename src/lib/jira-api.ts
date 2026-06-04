// JIRA REST 보조 호출 — 웹훅 라우트에서 "내가 담당하는 묶음(EPIC 등)" 판정에 사용.
// 인증: env JIRA_EMAIL + JIRA_API_TOKEN 으로 Basic 인증.
//   둘 중 하나라도 없으면 모든 헬퍼는 조용히 no-op(false)로 동작한다 —
//   토큰 등록 전까지 ⑤(EPIC 하위 상태 변경) 알림은 비활성, ④는 영향 없음.

const JIRA_FALLBACK_SITE = 'https://mirapartners.atlassian.net';

function authHeader(): string | null {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) return null;
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

// 웹훅 라우트와 동일한 방식으로 사이트 origin 유도 (issue.self → fallback).
function siteOriginFromIssue(issue: { self?: string } | undefined): string {
  try {
    if (issue?.self) return new URL(issue.self).origin;
  } catch {
    // fallback 유지
  }
  return JIRA_FALLBACK_SITE;
}

// fetch with 3s timeout. 실패 시 null (웹훅 응답을 막지 않기 위해 throw하지 않음).
async function jiraGet(url: string, auth: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn('[jira-api] non-ok response', url, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[jira-api] fetch failed', url, err);
    return null;
  }
}

// 이 이슈가 "내가 담당자인 부모(EPIC 등)" 아래의 하위 이슈인지 판정.
// 1) parent 식별: payload의 issue.fields.parent. 없으면 REST로 child 이슈의 parent 조회.
// 2) parent가 없으면 false. 있으면 parent의 assignee 조회.
// 3) parent.assignee === JIRA_OWNER_ACCOUNT_ID 이면 true.
//    parent의 issuetype이 Epic이 아니어도(일반 이슈의 서브태스크인 경우) 그 부모의
//    담당자가 나면 true — "내가 담당하는 묶음 아래의 변동"이라는 의도에 부합.
// 4) 인증(JIRA_EMAIL+JIRA_API_TOKEN) 미설정 시 조용히 false.
// 5) 어떤 fetch든 실패하면 false (웹훅 200 유지).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isMyEpicChild(issue: any): Promise<boolean> {
  const me = process.env.JIRA_OWNER_ACCOUNT_ID;
  if (!me) return false;
  const auth = authHeader();
  if (!auth) return false; // 토큰 미설정 → ⑤ 비활성

  const site = siteOriginFromIssue(issue);

  // 1) parent 키 식별
  let parentKey: string | undefined = issue?.fields?.parent?.key;
  if (!parentKey && issue?.key) {
    // 페이로드에 parent가 없으면 child 이슈를 REST로 조회해 parent 보강
    const child = await jiraGet(
      `${site}/rest/api/3/issue/${issue.key}?fields=parent`,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
    parentKey = child?.fields?.parent?.key;
  }

  // 2) parent 없으면 묶음이 아님
  if (!parentKey) return false;

  // parent의 assignee 조회 (issuetype은 의도 명시를 위해 같이 받지만 게이트하지 않음)
  const parent = await jiraGet(
    `${site}/rest/api/3/issue/${parentKey}?fields=assignee,issuetype`,
    auth,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
  if (!parent) return false;

  // 3) parent 담당자가 나면 true (issuetype 무관)
  return parent?.fields?.assignee?.accountId === me;
}

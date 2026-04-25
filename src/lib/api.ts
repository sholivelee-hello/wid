interface ApiFetchOptions extends RequestInit {
  suppressToast?: boolean;
}

export async function apiFetch<T>(url: string, options?: ApiFetchOptions): Promise<T> {
  const { suppressToast: _suppressToast, ...fetchOptions } = options ?? {};
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '알 수 없는 오류');
    throw new Error(errorText);
  }
  return await res.json();
}

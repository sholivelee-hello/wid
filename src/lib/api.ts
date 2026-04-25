import { toast } from 'sonner';

interface ApiFetchOptions extends RequestInit {
  suppressToast?: boolean;
}

export async function apiFetch<T>(url: string, options?: ApiFetchOptions): Promise<T> {
  const { suppressToast, ...fetchOptions } = options ?? {};
  try {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '알 수 없는 오류');
      if (!suppressToast) {
        toast.error(`요청 실패: ${errorText}`);
      }
      throw new Error(errorText);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof TypeError && !suppressToast) {
      toast.error('네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
}

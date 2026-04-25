import type { Task } from './types';

export function scoreTask(task: Task, query: string): number {
  if (!query.trim()) return 0;
  const q = query.toLowerCase().trim();

  let score = 0;
  if (task.title?.toLowerCase().includes(q)) score += 100;
  if (task.description?.toLowerCase().includes(q)) score += 50;
  if (task.requester?.toLowerCase().includes(q)) score += 30;
  if (task.delegate_to?.toLowerCase().includes(q)) score += 30;

  // Recency bonus (capped)
  const refDateStr = task.completed_at ?? task.created_at;
  if (refDateStr) {
    const refMs = new Date(refDateStr).getTime();
    const days = (Date.now() - refMs) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - Math.min(10, days));
  }

  return score;
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return [];
  return tasks
    .map(t => ({ task: t, score: scoreTask(t, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.task);
}
